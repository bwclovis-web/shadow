import { NextRequest, NextResponse } from "next/server"

import { getTradeByIdForParticipant } from "@/models/trade.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { createSuccessResponse } from "@/utils/response.server"
import { tradeRouteError } from "@/utils/trade-api-route.server"

type RouteContext = { params: Promise<{ tradeId: string }> }

export const GET = async (request: NextRequest, context: RouteContext) => {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const { tradeId } = await context.params
    const trade = await getTradeByIdForParticipant(tradeId, authResult.user!.id)
    if (!trade) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 })
    }

    return createSuccessResponse({ trade })
  } catch (error) {
    return tradeRouteError(error, "Failed to load trade")
  }
}
