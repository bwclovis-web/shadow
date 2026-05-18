"use server"

import type { DisputeCategory } from "@prisma/client"
import { redirect } from "next/navigation"

import { createTradeDispute } from "@/models/trade-dispute.server"
import { DISPUTE_CATEGORIES } from "@/utils/dispute-constants"
import { parseReportImagesJson } from "@/utils/report-images"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"

export type CreateTradeDisputeActionState = {
  success: boolean
  message: string
} | null

export const createTradeDisputeAction = async (
  _prevState: CreateTradeDisputeActionState,
  formData: FormData
): Promise<CreateTradeDisputeActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/the-exchange")
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const tradeId = formData.get("tradeId")
  const category = formData.get("category")
  const description = formData.get("description")

  if (typeof tradeId !== "string" || !tradeId) {
    return { success: false, message: "Invalid request" }
  }

  if (
    typeof category !== "string" ||
    !DISPUTE_CATEGORIES.includes(category as DisputeCategory)
  ) {
    return { success: false, message: "Please select a category" }
  }

  const images = parseReportImagesJson(formData.get("images"))

  return createTradeDispute({
    initiatedByUserId: session.user.id,
    tradeId,
    category: category as DisputeCategory,
    description: typeof description === "string" ? description : null,
    images,
  })
}
