import { NextRequest, NextResponse } from "next/server"

import { isDecantSplitsEnabled } from "@/utils/decant-splits-enabled.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { parseFormData } from "@/utils/server/api-route-helpers.server"

export const decantSplitsDisabledResponse = () =>
  NextResponse.json(
    { success: false, error: "Decant splits are not available" },
    { status: 404 }
  )

export const authenticateDecantSplitRequest = async (request: NextRequest) => {
  if (!isDecantSplitsEnabled()) {
    return { error: decantSplitsDisabledResponse() }
  }

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

export const decantSplitRouteError = (error: unknown, fallback: string) => {
  const msg = error instanceof Error ? error.message : fallback
  const status =
    msg.includes("Not authorized") ||
    msg.includes("Only the host") ||
    msg.includes("Cannot")
      ? 403
      : msg.includes("not found") || msg.includes("Not found")
        ? 404
        : 400
  return NextResponse.json({ success: false, error: msg }, { status })
}
