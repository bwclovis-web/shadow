import { NextRequest, NextResponse } from "next/server"

import { getPourableMlBudget } from "@/models/decant-split.server"
import { isDecantSplitsEnabled } from "@/utils/decant-splits-enabled.server"
import { decantSplitsDisabledResponse } from "@/utils/decant-split-api-route.server"
import { createSuccessResponse } from "@/utils/response.server"
import { authenticateUser } from "@/utils/server/auth.server"

export const GET = async (request: NextRequest) => {
  if (!isDecantSplitsEnabled()) {
    return decantSplitsDisabledResponse()
  }

  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status ?? 401 }
    )
  }

  const perfumeId = request.nextUrl.searchParams.get("perfumeId")
  if (!perfumeId) {
    return NextResponse.json(
      { success: false, error: "perfumeId is required" },
      { status: 400 }
    )
  }

  const budget = await getPourableMlBudget(authResult.user!.id, perfumeId)
  return createSuccessResponse({ budget })
}
