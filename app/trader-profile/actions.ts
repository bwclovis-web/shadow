"use server"

import type { UserReportCategory } from "@prisma/client"
import { redirect } from "next/navigation"

import {
  USER_REPORT_CATEGORIES,
  createUserReport,
  parseReportImagesJson,
} from "@/models/user-report.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"

export type CreateUserReportActionState = {
  success: boolean
  message: string
} | null

export const createUserReportAction = async (
  _prevState: CreateUserReportActionState,
  formData: FormData
): Promise<CreateUserReportActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect(`/sign-in?redirect=${encodeURIComponent("/the-exchange")}`)
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const reportedUserId = formData.get("reportedUserId")
  const category = formData.get("category")
  const description = formData.get("description")

  if (typeof reportedUserId !== "string" || !reportedUserId) {
    return { success: false, message: "Invalid request" }
  }

  if (typeof category !== "string" || !USER_REPORT_CATEGORIES.includes(category as UserReportCategory)) {
    return { success: false, message: "Please select a category" }
  }

  const images = parseReportImagesJson(formData.get("images"))

  const result = await createUserReport({
    reporterId: session.user.id,
    reportedUserId,
    category: category as UserReportCategory,
    description: typeof description === "string" ? description : null,
    images,
  })

  return result
}
