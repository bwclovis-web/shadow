"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { withdrawDispute } from "@/models/trade-dispute.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getProfileSlug } from "@/utils/user"

export type WithdrawDisputeActionState = {
  success: boolean
  message: string
} | null

export const withdrawDisputeAction = async (
  _prevState: WithdrawDisputeActionState,
  formData: FormData
): Promise<WithdrawDisputeActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const disputeId = formData.get("disputeId")
  if (typeof disputeId !== "string" || !disputeId) {
    return { success: false, message: "Invalid request" }
  }

  const result = await withdrawDispute(disputeId, session.user.id)
  if (result.success) {
    const slug = getProfileSlug(session.user)
    revalidatePath(`/${slug}/profile/disputes`)
    revalidatePath("/admin/disputes")
  }
  return result
}
