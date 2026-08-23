"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  createUser,
  getUserByEmail,
} from "@/models/user.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { membershipTierFromStripeMetadata } from "@/utils/membership/stripe-prices"
import { UserFormSchema } from "@/utils/validation/formValidationSchemas"
import { getSignupSubscribeRateLimits } from "@/utils/rate-limit-config.server"
import { getAuthCookieFlags } from "@/utils/security/auth-cookie.server"
import { createSession } from "@/utils/security/session-manager.server"
import {
  getTurnstileTokenFromFormData,
  verifyTurnstileToken,
} from "@/utils/security/turnstile.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import { getCheckoutSession } from "@/utils/server/stripe.server"
import { getProfilePathForUser } from "@/utils/user"
import { parseWithZod } from "@conform-to/zod"

const setSessionCookies = async (
  accessToken: string,
  refreshToken: string
): Promise<void> => {
  const cookieStore = await cookies()
  const flags = getAuthCookieFlags()
  cookieStore.set("accessToken", accessToken, {
    ...flags,
    maxAge: 60 * 60,
  })
  cookieStore.set("refreshToken", refreshToken, {
    ...flags,
    maxAge: 60 * 60 * 24 * 7,
  })
}

export type SignUpActionState =
  | { error?: string; submission?: ReturnType<Awaited<ReturnType<typeof parseWithZod>>["reply"]> }
  | null

export const signUpAction = async (
  _prevState: SignUpActionState,
  formData: FormData
): Promise<SignUpActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const rateLimits = getSignupSubscribeRateLimits()
  const clientId = getClientIdentifierFromHeaders(await headers())
  try {
    await validateRateLimit(
      `auth:signup:${clientId}`,
      rateLimits.signup.max,
      rateLimits.signup.windowMs
    )
  } catch (res) {
    if (res instanceof Response) {
      return {
        error:
          "Too many signup attempts. Please try again in a few minutes.",
        submission: undefined,
      }
    }
    throw res
  }

  const turnstile = await verifyTurnstileToken(
    getTurnstileTokenFromFormData(formData),
    clientId
  )
  if (!turnstile.ok) {
    return { error: turnstile.error, submission: undefined }
  }

  const sessionId = (formData.get("session_id") as string)?.trim() || null
  if (!sessionId) {
    redirect("/subscribe?tier=member&redirect=/sign-up")
  }

  const submission = parseWithZod(formData, { schema: UserFormSchema })

  if (submission.status !== "success") {
    return {
      error: "Please check the form for errors",
      submission: submission.reply(),
    }
  }

  const existingUser = await getUserByEmail(formData.get("email") as string)
  if (existingUser) {
    return { error: "Email already taken", submission: undefined }
  }

  const session = await getCheckoutSession(sessionId)
  const formEmail = (formData.get("email") as string)?.toLowerCase()
  const sessionEmail = (
    (session?.customer_details?.email as string) ||
    (session?.customer_email as string)
  )?.toLowerCase()
  if (
    session?.status !== "complete" ||
    !sessionEmail ||
    !formEmail ||
    sessionEmail !== formEmail
  ) {
    redirect("/subscribe?tier=member&redirect=/sign-up")
  }

  const membershipTier = membershipTierFromStripeMetadata(session.metadata)
  const user = await createUser(formData, {
    subscriptionStatus: "paid",
    membershipTier,
    isEarlyAdopter: false,
  })
  const { accessToken, refreshToken } = await createSession({
    userId: user.id,
    tokenVersion: user.tokenVersion ?? 0,
  })
  await setSessionCookies(accessToken, refreshToken)
  redirect(getProfilePathForUser(user))
}
