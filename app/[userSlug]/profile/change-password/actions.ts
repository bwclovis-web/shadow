"use server"

import { changePassword } from "@/models/user.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { ErrorHandler } from "@/utils/errorHandling"
import { getUserMutationRateLimits } from "@/utils/rate-limit-config.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { ChangePasswordSchema } from "@/utils/validation/formValidationSchemas"

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

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  if (!session?.user) {
    return { success: false, error: "Authentication required" }
  }

  const mutationLimits = getUserMutationRateLimits()
  try {
    validateRateLimit(
      `change-password:${session.user.id}`,
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
      session.user.id,
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
