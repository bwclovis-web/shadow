"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  createUser,
  FreeSignupLimitReachedError,
  getUserByEmail,
} from "@/models/user.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { UserFormSchema } from "@/utils/validation/formValidationSchemas"
import { getSignupSubscribeRateLimits } from "@/utils/rate-limit-config.server"
import { getAuthCookieFlags } from "@/utils/security/auth-cookie.server"
import { createSession } from "@/utils/security/session-manager.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import { getCheckoutSession } from "@/utils/server/stripe.server"
import { canSignupForFree } from "@/utils/server/user-limit.server"
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
    validateRateLimit(
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

  const sessionId = (formData.get("session_id") as string)?.trim() || null
  if (!sessionId) {
    const allowed = await canSignupForFree()
    if (!allowed) {
      redirect("/subscribe?redirect=/sign-up")
    }
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

  if (sessionId) {
    const session = await getCheckoutSession(sessionId)
    const formEmail = (formData.get("email") as string)?.toLowerCase()
    const sessionEmail = (
      (session?.customer_details?.email as string) ||
      (session?.customer_email as string)
    )?.toLowerCase()
    if (
      session?.status === "complete" &&
      sessionEmail &&
      formEmail &&
      sessionEmail === formEmail
    ) {
      const user = await createUser(formData, {
        subscriptionStatus: "paid",
        isEarlyAdopter: false,
      })
      const { accessToken, refreshToken } = await createSession({
        userId: user.id,
        tokenVersion: user.tokenVersion ?? 0,
      })
      await setSessionCookies(accessToken, refreshToken)
      redirect(getProfilePathForUser(user))
    }
  }

  const allowed = await canSignupForFree()
  if (!allowed) {
    redirect("/subscribe?redirect=/sign-up")
  }

  try {
    const user = await createUser(formData)
    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      tokenVersion: user.tokenVersion ?? 0,
    })
    await setSessionCookies(accessToken, refreshToken)
    redirect(getProfilePathForUser(user))
  } catch (err) {
    if (err instanceof FreeSignupLimitReachedError) {
      redirect("/subscribe?redirect=/sign-up")
    }
    throw err
  }
}
