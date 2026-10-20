import { NextRequest, NextResponse } from "next/server"

import { getPourableMlBudget } from "@/models/decant-split.server"
import { createSuccessResponse } from "@/utils/response.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"

/** Authoritative pourable-ml budget for destash / inventory (no splits feature flag). */
export const GET = async (request: NextRequest) => {
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
  if (!isValidPrismaRecordId(perfumeId)) {
    return NextResponse.json(
      { success: false, error: "Invalid ID format" },
      { status: 400 }
    )
  }

  const budget = await getPourableMlBudget(authResult.user!.id, perfumeId)
  return createSuccessResponse({ budget })
}
