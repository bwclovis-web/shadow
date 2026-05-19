import { NextRequest, NextResponse } from "next/server"

import { getDecantSplitById } from "@/models/decant-split.server"
import { isDecantSplitsEnabled } from "@/utils/decant-splits-enabled.server"
import { decantSplitsDisabledResponse } from "@/utils/decant-split-api-route.server"
import { createSuccessResponse } from "@/utils/response.server"
import { authenticateUser } from "@/utils/server/auth.server"

export const GET = async (
  request: NextRequest,
  context: { params: Promise<{ splitId: string }> }
) => {
  if (!isDecantSplitsEnabled()) {
    return decantSplitsDisabledResponse()
  }

  const { splitId } = await context.params
  let viewerId: string | null = null
  const authResult = await authenticateUser(request)
  if (authResult.success) {
    viewerId = authResult.user!.id
  }

  const split = await getDecantSplitById(splitId, viewerId)
  if (!split) {
    return NextResponse.json({ success: false, error: "Split not found" }, { status: 404 })
  }

  return createSuccessResponse({ split })
}
