import { NextRequest, NextResponse } from "next/server"
import { authenticateUser } from "@/utils/server/auth.server"
import { changePassword } from "@/models/user.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { ErrorHandler } from "@/utils/errorHandling"
import { getUserMutationRateLimits } from "@/utils/rate-limit-config.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    await requireCSRF(request, formData)

    const mutationLimits = getUserMutationRateLimits()
    try {
      validateRateLimit(
        `change-password:${authResult.user.id}`,
        mutationLimits.changePassword.max,
        mutationLimits.changePassword.windowMs
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) {
        return rateLimitResponse
      }
      throw rateLimitResponse
    }

    const currentPassword = formData.get("currentPassword") as string
    const newPassword = formData.get("newPassword") as string
    const confirmNewPassword = formData.get("confirmNewPassword") as string

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 }
      )
    }
    if (newPassword !== confirmNewPassword) {
      return NextResponse.json(
        { success: false, error: "New passwords do not match" },
        { status: 400 }
      )
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: "New password must be different from current password" },
        { status: 400 }
      )
    }

    const result = await changePassword(authResult.user.id, currentPassword, newPassword)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    const appError = ErrorHandler.handle(error, { api: "change-password" })
    return NextResponse.json(
      { success: false, error: appError.userMessage },
      { status: 500 }
    )
  }
}
