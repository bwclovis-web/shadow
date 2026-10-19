"use server"

import type { Prisma } from "@prisma/client"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  createTwoFactorSetup,
  replaceTwoFactorSecret,
  verifyTwoFactorAtSignIn,
} from "@/models/two-factor.server"
import { touchUserLastActive } from "@/models/user-activity.server"
import { getUserById } from "@/models/user.query"
import { validateRateLimit } from "@/utils/api-validation.server"
import { getAuthRateLimits } from "@/utils/rate-limit-config.server"
import {
  clearPending2faCookies,
  setSessionCookies,
} from "@/utils/security/auth-session-cookies.server"
import {
  createPending2faSetupToken,
  getPending2faCookieName,
  getPending2faSetupCookieName,
  getPending2faSetupCookieOptions,
  verifyPending2faSetupToken,
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

const completeVerifiedSignIn = async (
  userId: string,
  auditDetails: Prisma.InputJsonValue
): Promise<Verify2faActionState> => {
  const user = await getUserById(userId)
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
    details: auditDetails,
  })

  if (isLoginHeuristicsEnabled()) {
    await completeLoginSecurityCheck(user.id, await headers())
  }

  redirect(getProfilePathForUser(user))
}

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

    return completeVerifiedSignIn(pending.userId, {
      action: "two_factor_sign_in_success",
      useBackupCode,
    })
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message =
      error instanceof Error ? error.message : "Something went wrong. Please try again."
    return { error: message }
  }
}

export type BeginReplacementState =
  | { success: true; otpauthUri: string; manualKey: string }
  | { success: false; error: string }
  | null

const guardPendingSignIn = async (
  formData: FormData
): Promise<{ userId: string } | { error: string }> => {
  await requireCSRF(new Request("http://localhost", { method: "POST" }), formData)

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
      return { error: "Too many verification attempts. Please wait and try again." }
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
  return pending
}

export const beginAuthenticatorReplacementAction = async (
  _prev: BeginReplacementState,
  formData: FormData
): Promise<BeginReplacementState> => {
  try {
    const pending = await guardPendingSignIn(formData)
    if ("error" in pending) {
      return { success: false, error: pending.error }
    }

    const setup = await createTwoFactorSetup(pending.userId)
    if ("error" in setup) {
      return { success: false, error: setup.error }
    }

    const cookieStore = await cookies()
    cookieStore.set(
      getPending2faSetupCookieName(),
      createPending2faSetupToken(pending.userId, setup.secret),
      getPending2faSetupCookieOptions()
    )

    return {
      success: true,
      otpauthUri: setup.otpauthUri,
      manualKey: setup.secret,
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message =
      error instanceof Error ? error.message : "Something went wrong. Please try again."
    return { success: false, error: message }
  }
}

export const confirmAuthenticatorReplacementAction = async (
  _prev: Verify2faActionState,
  formData: FormData
): Promise<Verify2faActionState> => {
  try {
    const pending = await guardPendingSignIn(formData)
    if ("error" in pending) {
      return { error: pending.error }
    }

    const cookieStore = await cookies()
    const setupToken = cookieStore.get(getPending2faSetupCookieName())?.value
    if (!setupToken) {
      return { error: "That QR code expired. Generate a new one and scan it." }
    }
    const setup = verifyPending2faSetupToken(setupToken)
    if (!setup || setup.userId !== pending.userId) {
      cookieStore.set(getPending2faSetupCookieName(), "", {
        ...getPending2faSetupCookieOptions(),
        maxAge: 0,
      })
      return { error: "That QR code expired. Generate a new one and scan it." }
    }

    const code = String(formData.get("code") ?? "").trim()
    if (!code) {
      return { error: "Enter the 6-digit code from the new scan" }
    }

    const replaced = await replaceTwoFactorSecret(pending.userId, setup.secret, code)
    if (!replaced.success) {
      return { error: replaced.error }
    }

    return completeVerifiedSignIn(pending.userId, {
      action: "two_factor_secret_replaced",
      useBackupCode: false,
    })
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message =
      error instanceof Error ? error.message : "Something went wrong. Please try again."
    return { error: message }
  }
}
