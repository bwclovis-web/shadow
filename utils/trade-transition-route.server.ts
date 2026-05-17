import { NextRequest, NextResponse } from "next/server"

import { transitionTrade } from "@/models/trade.server"
import { createSuccessResponse } from "@/utils/response.server"
import {
  authenticateTradeRequest,
  tradeRouteError,
} from "@/utils/trade-api-route.server"
import { TradeShipTransitionSchema } from "@/utils/validation/formValidationSchemas"

type TransitionAction =
  | "accept"
  | "decline"
  | "ship"
  | "receive"
  | "complete"
  | "cancel"
  | "submit"

export const createTradeTransitionHandler =
  (action: TransitionAction) =>
  async (
    request: NextRequest,
    context: { params: Promise<{ tradeId: string }> }
  ) => {
    try {
      const auth = await authenticateTradeRequest(request)
      if ("error" in auth) return auth.error

      const { tradeId } = await context.params
      let metadata: Record<string, unknown> | undefined

      if (action === "ship") {
        const parsed = TradeShipTransitionSchema.safeParse({
          trackingNumber: auth.formData.get("trackingNumber") ?? undefined,
        })
        if (!parsed.success) {
          const message = parsed.error.flatten().fieldErrors.trackingNumber?.[0] ?? "Validation failed"
          return NextResponse.json({ success: false, error: message }, { status: 400 })
        }
        if (parsed.data.trackingNumber) {
          metadata = { trackingNumber: parsed.data.trackingNumber }
        }
      }

      const trade = await transitionTrade({
        tradeId,
        actorUserId: auth.userId,
        action,
        metadata,
      })

      return createSuccessResponse({ trade })
    } catch (error) {
      return tradeRouteError(error, `Failed to ${action} trade`)
    }
  }
