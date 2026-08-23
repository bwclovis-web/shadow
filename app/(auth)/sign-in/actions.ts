"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { isTwoFactorEnabled } from "@/models/two-factor.server"
import { updateUser } from "@/models/user.query"
import { touchUserLastActive } from "@/models/user-activity.server"
import { signInCustomer } from "@/models/user.server"
import { requireParticipation } from "@/utils/membership/entitlements.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { getAuthRateLimits } from "@/utils/rate-limit-config.server"
import { setSessionCookies } from "@/utils/security/auth-session-cookies.server"
import {
  assertAccountNotLocked,
  getLoginContext,
  isLoginHeuristicsEnabled,
  recordLoginAttempt,
} from "@/utils/security/login-security.server"
import {
  createPending2faToken,
  getPending2faCookieName,
  getPending2faCookieOptions,
} from "@/utils/security/pending-2fa.server"
import { createSession } from "@/utils/security/session-manager.server"
import {
  getTurnstileTokenFromFormData,
  verifyTurnstileToken,
} from "@/utils/security/turnstile.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import { getProfilePathForUser } from "@/utils/user"
import { generateUniqueUsername } from "@/utils/username-generator.server"

const isRedirectError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")

export type SignInActionState = { error?: string } | null

export const signInAction = async (
  _prevState: SignInActionState,
  formData: FormData
): Promise<SignInActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)

    const authLimits = getAuthRateLimits()
    const clientId = getClientIdentifierFromHeaders(await headers())
    try {
      await validateRateLimit(
        `auth:sign-in:${clientId}`,
        authLimits.signIn.max,
        authLimits.signIn.windowMs
      )
    } catch (res) {
      if (res instanceof Response) {
        return {
          error: "Too many sign-in attempts. Please wait and try again.",
        }
      }
      throw res
    }

    const turnstile = await verifyTurnstileToken(
      getTurnstileTokenFromFormData(formData),
      clientId
    )
    if (!turnstile.ok) {
      return { error: turnstile.error }
    }

    const signInResult = await signInCustomer(formData)
    const loginCtx = isLoginHeuristicsEnabled()
      ? await getLoginContext(await headers())
      : null

    if (signInResult.kind === "not_found") {
      return { error: "Invalid email or password" }
    }

    if (signInResult.kind === "invalid_password") {
      if (loginCtx) {
        await recordLoginAttempt({
          userId: signInResult.user.id,
          success: false,
          ctx: loginCtx,
          failureReason: "invalid_password",
        })
      }
      return { error: "Invalid email or password" }
    }

    const existingUser = signInResult.user

    if (isLoginHeuristicsEnabled()) {
      try {
        await assertAccountNotLocked(existingUser.id)
      } catch (lockoutError) {
        return {
          error:
            lockoutError instanceof Error
              ? lockoutError.message
              : "Too many failed sign-in attempts.",
        }
      }
    }

    if (existingUser.isBanned) {
      return { error: "Your account has been suspended" }
    }

    let user = existingUser
    if (!existingUser.username?.trim()) {
      const username = await generateUniqueUsername()
      await updateUser(existingUser.id, { username })
      user = { ...existingUser, username }
    }

    if (isTwoFactorEnabled(user)) {
      if (loginCtx) {
        await recordLoginAttempt({
          userId: user.id,
          success: true,
          ctx: loginCtx,
          skipHeuristics: true,
        })
      }
      const cookieStore = await cookies()
      const pendingToken = createPending2faToken(user.id)
      cookieStore.set(getPending2faCookieName(), pendingToken, getPending2faCookieOptions())
      redirect("/sign-in/verify-2fa")
    }

    if (loginCtx) {
      await recordLoginAttempt({
        userId: user.id,
        success: true,
        ctx: loginCtx,
      })
    }

    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      tokenVersion: user.tokenVersion ?? 0,
    })
    await setSessionCookies(accessToken, refreshToken)
    await touchUserLastActive(user.id)

    const participation = await requireParticipation(user.id)
    if (!participation.ok) {
      redirect(
        `/subscribe?tier=member&redirect=${encodeURIComponent(getProfilePathForUser(user))}`
      )
    }

    redirect(getProfilePathForUser(user))
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message =
      error instanceof Error ? error.message : "Something went wrong. Please try again."
    return { error: message }
  }
}
