import type { UserReportCategory, UserReportStatus } from "@prisma/client"

import { deleteFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"
import { prisma } from "@/lib/db"
import { parseReportImagesJson } from "@/utils/report-images"

export type UserReportWithRelations = Awaited<
  ReturnType<typeof getUserReportsForAdmin>
>[number]

export const USER_REPORT_CATEGORIES: UserReportCategory[] = [
  "scam",
  "fakeItem",
  "harassment",
  "noShip",
  "other",
]

export const USER_REPORT_STATUSES: UserReportStatus[] = [
  "inProgress",
  "settled",
  "passed",
]

const deleteReportImagesFromR2 = async (images: string[]) => {
  for (const url of images) {
    const key = getR2KeyFromPublicUrl(url)
    if (key?.startsWith("reports/")) {
      try {
        await deleteFromR2(key)
      } catch {
        // Best-effort cleanup; do not block report deletion
      }
    }
  }
}

export const createUserReport = async ({
  reporterId,
  reportedUserId,
  category,
  description,
  images,
}: {
  reporterId: string
  reportedUserId: string
  category: UserReportCategory
  description?: string | null
  images?: string[]
}): Promise<{ success: boolean; message: string; reportId?: string }> => {
  if (reporterId === reportedUserId) {
    return { success: false, message: "You cannot report your own account" }
  }

  if (!USER_REPORT_CATEGORIES.includes(category)) {
    return { success: false, message: "Invalid report category" }
  }

  const reported = await prisma.user.findUnique({
    where: { id: reportedUserId },
    select: { id: true, email: true, isBanned: true },
  })

  if (!reported) {
    return { success: false, message: "User not found" }
  }

  if (reported.email.startsWith("deleted_")) {
    return { success: false, message: "This account is no longer active" }
  }

  const trimmedDescription = description?.trim() || null
  const imageUrls = images ?? []

  const report = await prisma.userReport.create({
    data: {
      reporterId,
      reportedUserId,
      category,
      description: trimmedDescription,
      images: imageUrls,
      status: "inProgress",
    },
  })

  return {
    success: true,
    message: "Report submitted. Our team will review it.",
    reportId: report.id,
  }
}

export const getUserReportsForAdmin = async (
  statusFilter: UserReportStatus | "all" = "inProgress"
) => {
  return prisma.userReport.findMany({
    where: statusFilter === "all" ? undefined : { status: statusFilter },
    include: {
      reporter: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          strikeCount: true,
          isBanned: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export const getUserReportsByReporter = async (reporterId: string) => {
  return prisma.userReport.findMany({
    where: { reporterId },
    include: {
      reportedUser: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export const updateUserReportStatus = async (
  reportId: string,
  status: UserReportStatus,
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  if (!USER_REPORT_STATUSES.includes(status)) {
    return { success: false, message: "Invalid status" }
  }

  const report = await prisma.userReport.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  })

  if (!report) {
    return { success: false, message: "Report not found" }
  }

  await prisma.userReport.update({
    where: { id: reportId },
    data: { status },
  })

  await prisma.securityAuditLog.create({
    data: {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: adminId,
      action: "DATA_MODIFICATION",
      severity: "info",
      resource: "UserReport",
      resourceId: reportId,
      details: {
        previousStatus: report.status,
        newStatus: status,
        action: "User report status updated by admin",
      },
    },
  })

  return { success: true, message: "Report updated" }
}

export const withdrawUserReport = async (
  reportId: string,
  reporterId: string
): Promise<{ success: boolean; message: string }> => {
  const report = await prisma.userReport.findFirst({
    where: { id: reportId, reporterId },
    select: { id: true, status: true, images: true },
  })

  if (!report) {
    return { success: false, message: "Report not found" }
  }

  if (report.status !== "inProgress") {
    return {
      success: false,
      message: "Only in-progress reports can be withdrawn",
    }
  }

  await deleteReportImagesFromR2(report.images)
  await prisma.userReport.delete({ where: { id: reportId } })

  return { success: true, message: "Report withdrawn" }
}

export const deleteUserReportByAdmin = async (
  reportId: string,
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  const report = await prisma.userReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      category: true,
      reporterId: true,
      reportedUserId: true,
      images: true,
    },
  })

  if (!report) {
    return { success: false, message: "Report not found" }
  }

  await deleteReportImagesFromR2(report.images)
  await prisma.userReport.delete({ where: { id: reportId } })

  await prisma.securityAuditLog.create({
    data: {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: adminId,
      action: "DATA_MODIFICATION",
      severity: "info",
      resource: "UserReport",
      resourceId: reportId,
      details: {
        previousStatus: report.status,
        category: report.category,
        reporterId: report.reporterId,
        reportedUserId: report.reportedUserId,
        action: "User report deleted by admin",
      },
    },
  })

  return { success: true, message: "Report deleted" }
}

export const buildStrikeReasonFromReport = ({
  category,
  description,
  reportId,
}: {
  category: UserReportCategory
  description: string | null
  reportId: string
}): string => {
  const detail = description?.trim()
    ? ` — ${description.trim()}`
    : ""
  return `User report (${category}, #${reportId.slice(-8)})${detail}`
}

export { parseReportImagesJson }
