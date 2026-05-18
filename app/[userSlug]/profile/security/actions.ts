"use server"

import { cookies } from "next/headers"
import QRCode from "qrcode"

import {
  confirmTwoFactorEnrollment,
  disableTwoFactor,
  regenerateBackupCodes,
  startTwoFactorEnrollment,
} from "@/models/two-factor.server"
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

const requireSession = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  return session?.user ?? null
}

const rateLimitTwoFactor = (userId: string) => {
  const limits = getUserMutationRateLimits()
  validateRateLimit(
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
      rateLimitTwoFactor(user.id)
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
      rateLimitTwoFactor(user.id)
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
      rateLimitTwoFactor(user.id)
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
      rateLimitTwoFactor(user.id)
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
