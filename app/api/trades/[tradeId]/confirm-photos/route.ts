import { NextRequest } from "next/server"

import { confirmTradePhotos } from "@/models/trade.server"
import { createSuccessResponse } from "@/utils/response.server"
import {
  authenticateTradeRequest,
  tradeRouteError,
} from "@/utils/trade-api-route.server"

export const PATCH = async (
  request: NextRequest,
  context: { params: Promise<{ tradeId: string }> }
) => {
  try {
    const auth = await authenticateTradeRequest(request)
    if ("error" in auth) return auth.error

    const { tradeId } = await context.params
    const trade = await confirmTradePhotos(tradeId, auth.userId)
    return createSuccessResponse({ trade })
  } catch (error) {
    return tradeRouteError(error, "Failed to confirm trade photos")
  }
}
