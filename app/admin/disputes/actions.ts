"use server"

import type { DisputeResolutionOutcome, DisputeStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  DISPUTE_RESOLUTION_OUTCOMES,
  markDisputeUnderReview,
  resolveDispute,
  saveDisputeAdminNotes,
} from "@/models/trade-dispute.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"

export type DisputeAdminActionState = {
  success: boolean
  message: string
} | null

const requireAdmin = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/disputes")
  }

  if (session.user.role !== "admin") {
    return null
  }

  return { user: session.user }
}

const revalidateDisputesAdmin = () => {
  revalidatePath("/admin/disputes")
}

export const markUnderReviewAction = async (
  _prevState: DisputeAdminActionState,
  formData: FormData
): Promise<DisputeAdminActionState> => {
  const session = await requireAdmin()
  if (!session) return { success: false, message: "Unauthorized" }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const disputeId = formData.get("disputeId")
  if (typeof disputeId !== "string") {
    return { success: false, message: "Invalid request" }
  }

  const result = await markDisputeUnderReview(disputeId, session.user.id)
  if (result.success) revalidateDisputesAdmin()
  return result
}

export const saveAdminNotesAction = async (
  _prevState: DisputeAdminActionState,
  formData: FormData
): Promise<DisputeAdminActionState> => {
  const session = await requireAdmin()
  if (!session) return { success: false, message: "Unauthorized" }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const disputeId = formData.get("disputeId")
  const adminNotes = formData.get("adminNotes")

  if (typeof disputeId !== "string") {
    return { success: false, message: "Invalid request" }
  }

  const result = await saveDisputeAdminNotes(
    disputeId,
    typeof adminNotes === "string" ? adminNotes : "",
    session.user.id
  )
  if (result.success) revalidateDisputesAdmin()
  return result
}

export const resolveDisputeAction = async (
  _prevState: DisputeAdminActionState,
  formData: FormData
): Promise<DisputeAdminActionState> => {
  const session = await requireAdmin()
  if (!session) return { success: false, message: "Unauthorized" }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const disputeId = formData.get("disputeId")
  const resolutionOutcome = formData.get("resolutionOutcome")
  const publicSummary = formData.get("publicSummary")
  const strikeTargetUserId = formData.get("strikeTargetUserId")

  if (typeof disputeId !== "string" || typeof resolutionOutcome !== "string") {
    return { success: false, message: "Invalid request" }
  }

  if (
    !DISPUTE_RESOLUTION_OUTCOMES.includes(
      resolutionOutcome as DisputeResolutionOutcome
    )
  ) {
    return { success: false, message: "Invalid resolution outcome" }
  }

  const result = await resolveDispute({
    disputeId,
    adminId: session.user.id,
    resolutionOutcome: resolutionOutcome as DisputeResolutionOutcome,
    publicSummary: typeof publicSummary === "string" ? publicSummary : null,
    strikeTargetUserId:
      typeof strikeTargetUserId === "string" && strikeTargetUserId
        ? strikeTargetUserId
        : undefined,
  })

  if (result.success) revalidateDisputesAdmin()
  return result
}

export type DisputeStatusFilter = DisputeStatus | "all"
