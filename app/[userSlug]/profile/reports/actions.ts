"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { withdrawUserReport } from "@/models/user-report.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getProfileSlug } from "@/utils/user"

export type WithdrawReportActionState = {
  success: boolean
  message: string
} | null

export const withdrawReportAction = async (
  _prevState: WithdrawReportActionState,
  formData: FormData
): Promise<WithdrawReportActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const reportId = formData.get("reportId")
  if (typeof reportId !== "string" || !reportId) {
    return { success: false, message: "Invalid request" }
  }

  const result = await withdrawUserReport(reportId, session.user.id)
  if (result.success) {
    const slug = getProfileSlug(session.user)
    revalidatePath(`/${slug}/profile/reports`)
    revalidatePath("/admin/reports")
  }
  return result
}
