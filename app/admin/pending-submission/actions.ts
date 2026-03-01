"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import {
  getPendingSubmissionById,
  updatePendingSubmissionStatus,
} from "@/models/pending-submission.server"
import { createPerfume } from "@/models/perfume.server"
import { createPerfumeHouse } from "@/models/house.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"

export type PendingSubmissionActionState = {
  success: boolean
  message?: string
  error?: string
} | null

const getCookieHeader = async (): Promise<string> => {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}

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
      const submissionData = submission.submissionData
      const data =
        submissionData &&
        typeof submissionData === "object" &&
        !Array.isArray(submissionData)
          ? (submissionData as Record<string, unknown>)
          : null
      if (!data) {
        return { success: false, error: "Invalid submission data" }
      }
      if (submission.submissionType === "perfume") {
        const perfumeFormData = new FormData()
        Object.entries(data).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((v) => perfumeFormData.append(key, String(v)))
          } else {
            perfumeFormData.append(key, value as string)
          }
        })
        await createPerfume(perfumeFormData)
      } else {
        const houseFormData = new FormData()
        Object.entries(data).forEach(([key, value]) => {
          houseFormData.append(key, value as string)
        })
        await createPerfumeHouse(houseFormData)
      }

      await updatePendingSubmissionStatus(
        submissionId,
        "approved",
        session.user.id,
        adminNotes
      )

      revalidatePath("/admin/pending-submission")
      return {
        success: true,
        message: `${
          submission.submissionType === "perfume" ? "Perfume" : "Perfume house"
        } created successfully`,
      }
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
      await updatePendingSubmissionStatus(
        submissionId,
        "rejected",
        session.user.id,
        adminNotes
      )
      revalidatePath("/admin/pending-submission")
      return { success: true, message: "Submission rejected" }
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
