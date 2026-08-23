"use server"

import { cookies } from "next/headers"
import QRCode from "qrcode"

import { changePassword } from "@/models/user.server"
import {
  confirmTwoFactorEnrollment,
  disableTwoFactor,
  regenerateBackupCodes,
  startTwoFactorEnrollment,
} from "@/models/two-factor.server"
import { ErrorHandler } from "@/utils/errorHandling"
import { ChangePasswordSchema } from "@/utils/validation/formValidationSchemas"
import { validateRateLimit } from "@/utils/api-validation.server"
import { getUserMutationRateLimits } from "@/utils/rate-limit-config.server"
import { clearPending2faCookies } from "@/utils/security/auth-session-cookies.server"
import {
  createPending2faSetupToken,
  getPending2faSetupCookieName,
  getPending2faSetupCookieOptions,
  verifyPending2faSetupToken,
} from "@/utils/security/pending-2fa.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import {
  getUserActiveSessions,
  invalidateAllUserSessions,
  invalidateSession,
} from "@/utils/security/session-manager.server"

const requireSession = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  return session?.user ?? null
}

const rateLimitTwoFactor = async (userId: string) => {
  const limits = getUserMutationRateLimits()
  await validateRateLimit(
    `two-factor:${userId}`,
    limits.twoFactor.max,
    limits.twoFactor.windowMs
  )
}

export type StartEnrollmentState =
  | {
      success: true
      qrDataUrl: string
      manualKey: string
    }
  | { success: false; error: string }
  | null

export const startEnrollmentAction = async (
  _prev: StartEnrollmentState,
  formData: FormData
): Promise<StartEnrollmentState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)
    const user = await requireSession()
    if (!user) {
      return { success: false, error: "Authentication required" }
    }
    try {
      await rateLimitTwoFactor(user.id)
    } catch (e) {
      if (e instanceof Response) {
        return { success: false, error: "Too many attempts. Try again later." }
      }
      throw e
    }

    const result = await startTwoFactorEnrollment(user.id)
    if ("error" in result) {
      return { success: false, error: result.error }
    }

    const setupToken = createPending2faSetupToken(user.id, result.secret)
    const cookieStore = await cookies()
    cookieStore.set(
      getPending2faSetupCookieName(),
      setupToken,
      getPending2faSetupCookieOptions()
    )

    const qrDataUrl = await QRCode.toDataURL(result.otpauthUri)

    return {
      success: true,
      qrDataUrl,
      manualKey: result.secret,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    }
  }
}

export type ConfirmEnrollmentState =
  | { success: true; backupCodes: string[] }
  | { success: false; error: string }
  | null

export const confirmEnrollmentAction = async (
  _prev: ConfirmEnrollmentState,
  formData: FormData
): Promise<ConfirmEnrollmentState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)
    const user = await requireSession()
    if (!user) {
      return { success: false, error: "Authentication required" }
    }
    try {
      await rateLimitTwoFactor(user.id)
    } catch (e) {
      if (e instanceof Response) {
        return { success: false, error: "Too many attempts. Try again later." }
      }
      throw e
    }

    const cookieStore = await cookies()
    const setupToken = cookieStore.get(getPending2faSetupCookieName())?.value
    if (!setupToken) {
      return { success: false, error: "Setup session expired. Please start again." }
    }
    const pending = verifyPending2faSetupToken(setupToken)
    if (!pending || pending.userId !== user.id) {
      await clearPending2faCookies()
      return { success: false, error: "Setup session expired. Please start again." }
    }

    const password = String(formData.get("password") ?? "")
    const code = String(formData.get("code") ?? "")
    const result = await confirmTwoFactorEnrollment(
      user.id,
      pending.secret,
      code,
      password
    )
    if (!result.success) {
      return { success: false, error: result.error }
    }

    cookieStore.set(getPending2faSetupCookieName(), "", {
      ...getPending2faSetupCookieOptions(),
      maxAge: 0,
    })

    return { success: true, backupCodes: result.backupCodes }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    }
  }
}

export type DisableTwoFactorState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null

export const disableTwoFactorAction = async (
  _prev: DisableTwoFactorState,
  formData: FormData
): Promise<DisableTwoFactorState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)
    const user = await requireSession()
    if (!user) {
      return { success: false, error: "Authentication required" }
    }
    try {
      await rateLimitTwoFactor(user.id)
    } catch (e) {
      if (e instanceof Response) {
        return { success: false, error: "Too many attempts. Try again later." }
      }
      throw e
    }

    const password = String(formData.get("password") ?? "")
    const code = String(formData.get("code") ?? "")
    const useBackupCode = formData.get("useBackupCode") === "true"

    const result = await disableTwoFactor(user.id, password, code, useBackupCode)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return {
      success: true,
      message: "Two-factor authentication has been disabled. Sign in again on other devices.",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    }
  }
}

export type RegenerateBackupCodesState =
  | { success: true; backupCodes: string[] }
  | { success: false; error: string }
  | null

export type ChangePasswordActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null

export const changePasswordAction = async (
  _prev: ChangePasswordActionState,
  formData: FormData
): Promise<ChangePasswordActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)
  } catch {
    return { success: false, error: "Invalid security token" }
  }

  const user = await requireSession()
  if (!user) {
    return { success: false, error: "Authentication required" }
  }

  const mutationLimits = getUserMutationRateLimits()
  try {
    await validateRateLimit(
      `change-password:${user.id}`,
      mutationLimits.changePassword.max,
      mutationLimits.changePassword.windowMs
    )
  } catch (e) {
    if (e instanceof Response) {
      const data = (await e.json().catch(() => ({}))) as { error?: string }
      return {
        success: false,
        error: data.error ?? "Too many attempts. Try again later.",
      }
    }
    throw e
  }

  const raw = {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmNewPassword: String(formData.get("confirmNewPassword") ?? ""),
  }

  const parsed = ChangePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors
    const msg =
      Object.values(first).flat()[0] ??
      parsed.error.errors[0]?.message ??
      "Validation failed"
    return { success: false, error: msg }
  }

  try {
    const result = await changePassword(
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    )
    if (result.success) {
      return {
        success: true,
        message: result.message ?? "Password changed successfully.",
      }
    }
    return { success: false, error: result.error ?? "Failed to change password" }
  } catch (error) {
    const appError = ErrorHandler.handle(error, { action: "change-password" })
    return { success: false, error: appError.userMessage }
  }
}

export const regenerateBackupCodesAction = async (
  _prev: RegenerateBackupCodesState,
  formData: FormData
): Promise<RegenerateBackupCodesState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)
    const user = await requireSession()
    if (!user) {
      return { success: false, error: "Authentication required" }
    }
    try {
      await rateLimitTwoFactor(user.id)
    } catch (e) {
      if (e instanceof Response) {
        return { success: false, error: "Too many attempts. Try again later." }
      }
      throw e
    }

    const password = String(formData.get("password") ?? "")
    const code = String(formData.get("code") ?? "")
    const result = await regenerateBackupCodes(user.id, password, code)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, backupCodes: result.backupCodes }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    }
  }
}

export type ActiveSessionRow = {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
}

export const listActiveSessionsForUser = async (
  userId: string
): Promise<ActiveSessionRow[]> => {
  const sessions = await getUserActiveSessions(userId)
  return sessions.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  }))
}

export type RevokeSessionState =
  | { success: true }
  | { success: false; error: string }
  | null

export const revokeSessionAction = async (
  _prev: RevokeSessionState,
  formData: FormData
): Promise<RevokeSessionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)
    const user = await requireSession()
    if (!user) return { success: false, error: "Authentication required" }

    const sessionId = String(formData.get("sessionId") ?? "").trim()
    if (!sessionId) return { success: false, error: "Session id required" }

    const owned = await getUserActiveSessions(user.id)
    if (!owned.some((s) => s.id === sessionId)) {
      return { success: false, error: "Session not found" }
    }
    await invalidateSession(sessionId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    }
  }
}

export const revokeAllOtherSessionsAction = async (
  _prev: RevokeSessionState,
  formData: FormData
): Promise<RevokeSessionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)
    const user = await requireSession()
    if (!user) return { success: false, error: "Authentication required" }
    await invalidateAllUserSessions(user.id)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    }
  }
}
