import { NextRequest } from "next/server"

import { confirmDecantSplitSlotReceived } from "@/models/decant-split.server"
import {
  authenticateDecantSplitRequest,
  decantSplitRouteError,
} from "@/utils/decant-split-api-route.server"
import { createSuccessResponse } from "@/utils/response.server"

export const POST = async (
  request: NextRequest,
  context: { params: Promise<{ splitId: string; slotId: string }> }
) => {
  try {
    const auth = await authenticateDecantSplitRequest(request)
    if ("error" in auth) return auth.error

    const { splitId, slotId } = await context.params
    const split = await confirmDecantSplitSlotReceived(
      splitId,
      slotId,
      auth.userId
    )
    return createSuccessResponse({ split })
  } catch (error) {
    return decantSplitRouteError(error, "Failed to confirm receipt")
  }
}
