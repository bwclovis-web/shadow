import {
  buildHouseFormDataFromSubmission,
  buildPerfumeFormDataFromSubmission,
  extractInventoryIntent,
  isCsvImportSubmission,
} from "@/lib/csv-import-pending-submission"
import { prisma } from "@/lib/db"
import type { PendingSubmission, PendingSubmissionStatus, PendingSubmissionType } from "@/types/database"
import { createPerfumeHouse, getPerfumeHouseByName } from "./house.server"
import { createPerfume } from "./perfume.server"
import { addUserPerfume } from "./user.server"
import { createUserAlert } from "./user-alerts.server"

export type ApprovePendingSubmissionResult =
  | { success: true; message: string }
  | { success: false; error: string }

type PendingSubmissionRecord = PendingSubmission & {
  submissionData: Record<string, unknown>
}

/**
 * Create a new pending submission
 */
export async function createPendingSubmission(
  submissionType: PendingSubmissionType,
  submissionData: Record<string, any>,
  submittedBy?: string
): Promise<PendingSubmission> {
  const created = await prisma.pendingSubmission.create({
    data: {
      submissionType,
      submissionData,
      submittedBy: submittedBy || null,
    },
  })
  return created as PendingSubmission
}

/**
 * Get all pending submissions
 */
export async function getPendingSubmissions(status?: PendingSubmissionStatus) {
  return await prisma.pendingSubmission.findMany({
    where: status ? { status } : undefined,
    include: {
      submittedByUser: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      reviewedByUser: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

/**
 * Get a pending submission by ID
 */
export async function getPendingSubmissionById(id: string) {
  return await prisma.pendingSubmission.findUnique({
    where: { id },
    include: {
      submittedByUser: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      reviewedByUser: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
  })
}

/**
 * Update pending submission status
 */
export async function updatePendingSubmissionStatus(
  id: string,
  status: PendingSubmissionStatus,
  reviewedBy: string,
  adminNotes?: string
) {
  return await prisma.pendingSubmission.update({
    where: { id },
    data: {
      status,
      reviewedBy,
      reviewedAt: new Date(),
      adminNotes: adminNotes || null,
    },
  })
}

/**
 * Get count of pending submissions
 */
export async function getPendingSubmissionCount(): Promise<number> {
  return await prisma.pendingSubmission.count({
    where: {
      status: "pending",
    },
  })
}

/**
 * Get all admin users
 */
export async function getAllAdminUsers() {
  return await prisma.user.findMany({
    where: {
      role: "admin",
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
    },
  })
}

/**
 * Get or create a system placeholder perfume for admin alerts
 */
async function getSystemPlaceholderPerfume() {
  const systemPerfume = await prisma.perfume.findFirst({
    where: {
      slug: "system-admin-alerts",
    },
  })

  if (systemPerfume) {
    return systemPerfume.id
  }

  // Create a system placeholder perfume if it doesn't exist
  const newPerfume = await prisma.perfume.create({
    data: {
      name: "System Admin Alerts",
      slug: "system-admin-alerts",
      description: "System placeholder for admin alerts",
    },
  })

  return newPerfume.id
}

/**
 * Create admin alerts for all admins when a pending submission is created
 */
export async function createAdminAlertsForPendingSubmission(
  submissionId: string,
  submissionType: PendingSubmissionType,
  submissionData: Record<string, any>
) {
  const admins = await getAllAdminUsers()
  const placeholderPerfumeId = await getSystemPlaceholderPerfume()

  const submissionName = submissionType === "perfume" 
    ? submissionData.name || "Unknown Perfume"
    : submissionData.name || "Unknown Perfume House"

  const title = `New ${submissionType === "perfume" ? "Perfume" : "Perfume House"} Submission`
  const message = `A new ${submissionType === "perfume" ? "perfume" : "perfume house"} submission for "${submissionName}" is pending approval.`

  // Create alerts for all admins
  const alertPromises = admins.map(admin =>
    createUserAlert(
      admin.id,
      placeholderPerfumeId,
      "pending_submission_approval",
      title,
      message,
      {
        submissionId,
        submissionType,
        submissionName,
      }
    )
  )

  await Promise.all(alertPromises)
}

export const approvePendingSubmission = async (
  submission: PendingSubmissionRecord,
  reviewerId: string,
  adminNotes?: string
): Promise<ApprovePendingSubmissionResult> => {
  const data =
    submission.submissionData &&
    typeof submission.submissionData === "object" &&
    !Array.isArray(submission.submissionData)
      ? (submission.submissionData as Record<string, unknown>)
      : null

  if (!data) {
    return { success: false, error: "Invalid submission data" }
  }

  if (submission.submissionType === "perfume_house") {
    const houseFormData = buildHouseFormDataFromSubmission(data)
    await createPerfumeHouse(houseFormData)
    await updatePendingSubmissionStatus(
      submission.id,
      "approved",
      reviewerId,
      adminNotes
    )
    return { success: true, message: "Perfume house created successfully" }
  }

  if (submission.submissionType !== "perfume") {
    return { success: false, error: "Unsupported submission type" }
  }

  const pendingHouseSubmissionId =
    typeof data.pendingHouseSubmissionId === "string"
      ? data.pendingHouseSubmissionId
      : undefined

  if (pendingHouseSubmissionId) {
    const linkedHouse = await getPendingSubmissionById(pendingHouseSubmissionId)
    if (!linkedHouse) {
      return {
        success: false,
        error: "Linked perfume house submission was not found",
      }
    }
    if (linkedHouse.status === "pending") {
      return {
        success: false,
        error: "Approve the linked perfume house submission first",
      }
    }
    if (linkedHouse.status === "rejected") {
      return {
        success: false,
        error:
          "Linked perfume house submission was rejected. Reject this perfume submission as well.",
      }
    }
  }

  let resolvedHouseId =
    typeof data.house === "string" && data.house.trim() ? data.house.trim() : undefined

  if (!resolvedHouseId && typeof data.houseName === "string" && data.houseName.trim()) {
    const house = await getPerfumeHouseByName(data.houseName)
    if (house) {
      resolvedHouseId = house.id
    }
  }

  if (!resolvedHouseId) {
    return {
      success: false,
      error: "Could not resolve perfume house for this submission",
    }
  }

  const perfumeFormData = buildPerfumeFormDataFromSubmission(data, resolvedHouseId)
  const newPerfume = await createPerfume(perfumeFormData)

  const submitterId = submission.submittedBy
  if (submitterId && isCsvImportSubmission(data)) {
    const inventoryIntent = extractInventoryIntent(data)
    if (inventoryIntent) {
      const existing = await prisma.userPerfume.findFirst({
        where: { userId: submitterId, perfumeId: newPerfume.id },
        select: { id: true },
      })
      if (!existing) {
        await addUserPerfume({
          userId: submitterId,
          perfumeId: newPerfume.id,
          amount: inventoryIntent.amount,
          ...(inventoryIntent.condition && { condition: inventoryIntent.condition }),
          tradePreference: inventoryIntent.tradePreference,
        })
      }
    }
  }

  await updatePendingSubmissionStatus(submission.id, "approved", reviewerId, adminNotes)

  const collectionNote =
    submitterId && isCsvImportSubmission(data)
      ? " Submitter's collection was updated."
      : ""

  return {
    success: true,
    message: `Perfume created successfully.${collectionNote}`,
  }
}

