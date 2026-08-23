import { NextRequest, NextResponse } from "next/server"

import { createTrade } from "@/models/trade.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { createSuccessResponse } from "@/utils/response.server"
import { getTradeCreateRateLimits } from "@/utils/trade-rate-limit-config.server"
import {
  authenticateTradeRequest,
  parseLineItemsJson,
  tradeRouteError,
} from "@/utils/trade-api-route.server"
import { CreateTradeSchema } from "@/utils/validation/formValidationSchemas"

export const POST = async (request: NextRequest) => {
  try {
    const auth = await authenticateTradeRequest(request)
    if ("error" in auth) return auth.error

    const { userId, formData } = auth
    const lineItems = parseLineItemsJson(formData.get("lineItems"))

    const parsed = CreateTradeSchema.safeParse({
      counterpartyId: formData.get("counterpartyId"),
      notes: formData.get("notes") ?? undefined,
      lineItems: lineItems ?? [],
      submit: formData.get("submit") ?? undefined,
    })

    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message =
        first.lineItems?.[0] ??
        first.counterpartyId?.[0] ??
        first.notes?.[0] ??
        "Validation failed"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const { counterpartyId, notes, lineItems: items, submit } = parsed.data

    const limits = getTradeCreateRateLimits()
    try {
      await validateRateLimit(
        `trade-create:user:${userId}`,
        limits.perUser.max,
        limits.perUser.windowMs
      )
      await validateRateLimit(
        `trade-create:pair:${userId}:${counterpartyId}`,
        limits.perPair.max,
        limits.perPair.windowMs
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) return rateLimitResponse
      throw rateLimitResponse
    }

    const trade = await createTrade({
      initiatorId: userId,
      counterpartyId,
      notes,
      lineItems: items,
      submit,
    })

    return createSuccessResponse({ trade })
  } catch (error) {
    return tradeRouteError(error, "Failed to create trade")
  }
}
