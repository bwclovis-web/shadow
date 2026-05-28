"use server"

import { revalidatePath } from "next/cache"

import {
  approvePendingSubmission,
  getPendingSubmissionById,
  rejectPendingSubmission,
} from "@/models/pending-submission.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import {
  revalidateHouseDataCache,
  revalidatePerfumeDataCache,
} from "@/utils/server/revalidate-catalog-cache.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { requireCSRF } from "@/utils/server/csrf.server"

export type PendingSubmissionActionState = {
  success: boolean
  message?: string
  error?: string
} | null

export const processPendingSubmissionAction = async (
  _prevState: PendingSubmissionActionState,
  formData: FormData
): Promise<PendingSubmissionActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  if (session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" }
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const actionType = formData.get("action") as string
  const submissionId = formData.get("submissionId") as string
  const adminNotes = (formData.get("adminNotes") as string) || undefined

  if (!actionType || !submissionId) {
    return { success: false, error: "Missing required fields" }
  }

  const submission = await getPendingSubmissionById(submissionId)
  if (!submission) {
    return { success: false, error: "Submission not found" }
  }

  if (actionType === "approve") {
    try {
      const result = await approvePendingSubmission(
        {
          ...submission,
          submissionData: submission.submissionData as Record<string, unknown>,
        },
        session.user.id,
        adminNotes
      )

      if (!result.success) {
        return { success: false, error: result.error }
      }

      revalidatePerfumeDataCache()
      revalidateHouseDataCache()
      revalidatePath("/admin/pending-submission")
      return { success: true, message: result.message }
    } catch (error) {
      console.error("Error approving submission:", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to approve submission",
      }
    }
  }

  if (actionType === "reject") {
    try {
      const result = await rejectPendingSubmission(
        {
          ...submission,
          submissionData: submission.submissionData as Record<string, unknown>,
        },
        session.user.id,
        adminNotes
      )
      if (!result.success) {
        return { success: false, error: result.error }
      }
      revalidatePerfumeDataCache()
      revalidateHouseDataCache()
      revalidatePath("/admin/pending-submission")
      return { success: true, message: result.message }
    } catch (error) {
      console.error("Error rejecting submission:", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to reject submission",
      }
    }
  }

  return { success: false, error: "Invalid action" }
}
