import { NextRequest, NextResponse } from "next/server"

import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { parseFormData } from "@/utils/server/api-route-helpers.server"

export const authenticateTradeRequest = async (request: NextRequest) => {
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return {
      error: NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status ?? 401 }
      ),
    }
  }

  try {
    const formData = await parseFormData(request)
    await requireCSRF(request, formData)
    return { userId: authResult.user!.id, formData }
  } catch (error) {
    if (error instanceof CSRFError) {
      return {
        error: NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        ),
      }
    }
    throw error
  }
}

export const parseLineItemsJson = (
  raw: FormDataEntryValue | null
): { userPerfumeId: string; role: "offered" | "requested" }[] | null => {
  if (raw == null || typeof raw !== "string" || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as { userPerfumeId: string; role: "offered" | "requested" }[]
  } catch {
    return null
  }
}

export const tradeRouteError = (error: unknown, fallback: string) => {
  const msg = error instanceof Error ? error.message : fallback
  const status =
    msg.includes("Not authorized") ||
    msg.includes("Only the") ||
    msg.includes("Cannot")
      ? 403
      : msg.includes("not found") || msg.includes("Not found")
        ? 404
        : 400
  return NextResponse.json({ success: false, error: msg }, { status })
}
