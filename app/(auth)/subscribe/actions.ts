"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSiteUrl } from "@/lib/seo/site-url"
import { validateRateLimit } from "@/utils/api-validation.server"
import { parseCheckoutTier } from "@/utils/membership/stripe-prices"
import { getSignupSubscribeRateLimits } from "@/utils/rate-limit-config.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import { createCheckoutSession } from "@/utils/server/stripe.server"
import { sanitizeRedirectPath } from "@/utils/server/subscribe-redirect.server"
import { SubscribeCheckoutSchema } from "@/utils/validation/formValidationSchemas"
import { parseWithZod } from "@conform-to/zod"

const isRedirectError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")

export type SubscribeActionState =
  | {
      error?: string
      submission?: ReturnType<
        Awaited<ReturnType<typeof parseWithZod>>["reply"]
      >
    }
  | null

export const subscribeAction = async (
  _prevState: SubscribeActionState,
  formData: FormData
): Promise<SubscribeActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const rateLimits = getSignupSubscribeRateLimits()
  const clientId = getClientIdentifierFromHeaders(await headers())
  try {
    await validateRateLimit(
      `auth:subscribe:${clientId}`,
      rateLimits.subscribe.max,
      rateLimits.subscribe.windowMs
    )
  } catch (res) {
    if (res instanceof Response) {
      return {
        error:
          "Too many checkout attempts. Please try again in a few minutes.",
        submission: undefined,
      }
    }
    throw res
  }

  const submission = parseWithZod(formData, {
    schema: SubscribeCheckoutSchema,
  })

  if (submission.status !== "success") {
    return {
      error: "Please enter a valid email address",
      submission: submission.reply(),
    }
  }

  const email = submission.value.email.trim().toLowerCase()
  const checkoutTier = parseCheckoutTier(
    submission.value.tier ?? (formData.get("tier") as string | null)
  )
  const redirectPath = sanitizeRedirectPath(
    (formData.get("redirect") as string)?.trim() || null
  )
  const baseUrl = getSiteUrl()
  const successUrl = `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}&redirect=${encodeURIComponent(redirectPath)}`
  const cancelUrl = `${baseUrl}/subscribe?tier=${checkoutTier}&redirect=${encodeURIComponent(redirectPath)}&canceled=1`

  try {
    const session = await createCheckoutSession({
      successUrl,
      cancelUrl,
      checkoutTier,
      customerEmail: email,
      metadata: {
        redirect: redirectPath,
        signup_email: email,
        membership_tier: checkoutTier,
      },
    })

    if (!session.url) {
      return {
        error: "Unable to start checkout. Please try again.",
        submission: undefined,
      }
    }

    redirect(session.url)
  } catch (err) {
    if (isRedirectError(err)) throw err
    console.error("Subscribe checkout failed:", err)
    return {
      error: "Checkout is temporarily unavailable. Please try again later.",
      submission: undefined,
    }
  }
}
