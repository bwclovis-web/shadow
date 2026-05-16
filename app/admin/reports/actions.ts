"use server"

import type { UserReportCategory, UserReportStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { issueStrike } from "@/models/admin.server"
import {
  USER_REPORT_STATUSES,
  buildStrikeReasonFromReport,
  deleteUserReportByAdmin,
  updateUserReportStatus,
} from "@/models/user-report.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"

export type ReportAdminActionState = {
  success: boolean
  message: string
} | null

const requireAdmin = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/reports")
  }

  if (session.user.role !== "admin") {
    return null
  }

  return { user: session.user }
}

export const updateReportStatusAction = async (
  _prevState: ReportAdminActionState,
  formData: FormData
): Promise<ReportAdminActionState> => {
  const session = await requireAdmin()
  if (!session) {
    return { success: false, message: "Unauthorized" }
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const reportId = formData.get("reportId")
  const status = formData.get("status")

  if (typeof reportId !== "string" || typeof status !== "string") {
    return { success: false, message: "Invalid request" }
  }

  if (!USER_REPORT_STATUSES.includes(status as UserReportStatus)) {
    return { success: false, message: "Invalid status" }
  }

  const result = await updateUserReportStatus(
    reportId,
    status as UserReportStatus,
    session.user.id
  )
  if (result.success) {
    revalidatePath("/admin/reports")
  }
  return result
}

export const deleteReportAction = async (
  _prevState: ReportAdminActionState,
  formData: FormData
): Promise<ReportAdminActionState> => {
  const session = await requireAdmin()
  if (!session) {
    return { success: false, message: "Unauthorized" }
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const reportId = formData.get("reportId")
  if (typeof reportId !== "string") {
    return { success: false, message: "Invalid request" }
  }

  const result = await deleteUserReportByAdmin(reportId, session.user.id)
  if (result.success) {
    revalidatePath("/admin/reports")
  }
  return result
}

export const issueStrikeFromReportAction = async (
  _prevState: ReportAdminActionState,
  formData: FormData
): Promise<ReportAdminActionState> => {
  const session = await requireAdmin()
  if (!session) {
    return { success: false, message: "Unauthorized" }
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const reportId = formData.get("reportId")
  const userId = formData.get("userId")
  const reason = formData.get("reason")
  const category = formData.get("category")
  const description = formData.get("description")

  if (typeof reportId !== "string" || typeof userId !== "string") {
    return { success: false, message: "Invalid request" }
  }

  const strikeReason =
    typeof reason === "string" && reason.trim()
      ? reason.trim()
      : buildStrikeReasonFromReport({
          category:
            typeof category === "string"
              ? (category as UserReportCategory)
              : "other",
          description: typeof description === "string" ? description : null,
          reportId,
        })

  const strikeResult = await issueStrike(userId, strikeReason, session.user.id)
  if (!strikeResult.success) {
    return strikeResult
  }

  await updateUserReportStatus(reportId, "settled", session.user.id)
  revalidatePath("/admin/reports")
  revalidatePath("/admin/users")

  return {
    success: true,
    message: `${strikeResult.message} Report marked as settled.`,
  }
}
