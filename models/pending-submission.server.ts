import { prisma } from "~/db.server"
import type { PendingSubmission, PendingSubmissionStatus, PendingSubmissionType } from "~/types/database"
import { createUserAlert } from "./user-alerts.server"

/**
 * Create a new pending submission
 */
export async function createPendingSubmission(
  submissionType: PendingSubmissionType,
  submissionData: Record<string, any>,
  submittedBy?: string
): Promise<PendingSubmission> {
  return await prisma.pendingSubmission.create({
    data: {
      submissionType,
      submissionData,
      submittedBy: submittedBy || null,
    },
  })
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

