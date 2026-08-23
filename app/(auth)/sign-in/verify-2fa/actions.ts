"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { verifyTwoFactorAtSignIn } from "@/models/two-factor.server"
import { touchUserLastActive } from "@/models/user-activity.server"
import { getUserById } from "@/models/user.query"
import { validateRateLimit } from "@/utils/api-validation.server"
import { getAuthRateLimits } from "@/utils/rate-limit-config.server"
import {
  clearPending2faCookies,
  setSessionCookies,
} from "@/utils/security/auth-session-cookies.server"
import {
  getPending2faCookieName,
  verifyPending2faToken,
} from "@/utils/security/pending-2fa.server"
import { createSession } from "@/utils/security/session-manager.server"
import {
  completeLoginSecurityCheck,
  getLoginContext,
  isLoginHeuristicsEnabled,
  recordLoginAttempt,
} from "@/utils/security/login-security.server"
import { logTwoFactorAudit } from "@/utils/security/two-factor-audit.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import { getProfilePathForUser } from "@/utils/user"

const isRedirectError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")

export type Verify2faActionState = { error?: string } | null

export const verify2faAction = async (
  _prevState: Verify2faActionState,
  formData: FormData
): Promise<Verify2faActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)

    const authLimits = getAuthRateLimits()
    const clientId = getClientIdentifierFromHeaders(await headers())
    try {
      await validateRateLimit(
        `auth:verify-2fa:${clientId}`,
        authLimits.verify2fa.max,
        authLimits.verify2fa.windowMs
      )
    } catch (res) {
      if (res instanceof Response) {
        return {
          error: "Too many verification attempts. Please wait and try again.",
        }
      }
      throw res
    }

    const cookieStore = await cookies()
    const pendingToken = cookieStore.get(getPending2faCookieName())?.value
    if (!pendingToken) {
      redirect("/sign-in?error=2fa_expired")
    }

    const pending = verifyPending2faToken(pendingToken)
    if (!pending) {
      await clearPending2faCookies()
      redirect("/sign-in?error=2fa_expired")
    }

    const code = String(formData.get("code") ?? "").trim()
    const useBackupCode = formData.get("useBackupCode") === "true"
    if (!code) {
      return { error: "Enter your verification code" }
    }

    const valid = await verifyTwoFactorAtSignIn(
      pending.userId,
      code,
      useBackupCode
    )
    if (!valid) {
      await logTwoFactorAudit({
        userId: pending.userId,
        action: "LOGIN_FAILED",
        severity: "warning",
        resourceId: pending.userId,
        details: { action: "two_factor_sign_in_failed", useBackupCode },
      })
      if (isLoginHeuristicsEnabled()) {
        const ctx = await getLoginContext(await headers())
        await recordLoginAttempt({
          userId: pending.userId,
          success: false,
          ctx,
          failureReason: "two_factor_failed",
        })
      }
      return { error: "Invalid verification code" }
    }

    const user = await getUserById(pending.userId)
    if (!user || user.isBanned) {
      await clearPending2faCookies()
      return { error: "Your account has been suspended" }
    }

    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      tokenVersion: user.tokenVersion ?? 0,
    })
    await clearPending2faCookies()
    await setSessionCookies(accessToken, refreshToken)
    await touchUserLastActive(user.id)

    await logTwoFactorAudit({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      severity: "info",
      resourceId: user.id,
      details: { action: "two_factor_sign_in_success", useBackupCode },
    })

    if (isLoginHeuristicsEnabled()) {
      await completeLoginSecurityCheck(user.id, await headers())
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
