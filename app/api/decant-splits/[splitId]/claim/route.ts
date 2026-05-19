import { NextRequest } from "next/server"

import { claimDecantSplitSlot } from "@/models/decant-split.server"
import {
  authenticateDecantSplitRequest,
  decantSplitRouteError,
} from "@/utils/decant-split-api-route.server"
import { createSuccessResponse } from "@/utils/response.server"
import { DecantSplitSlotActionSchema } from "@/utils/validation/formValidationSchemas"

export const POST = async (
  request: NextRequest,
  context: { params: Promise<{ splitId: string }> }
) => {
  try {
    const auth = await authenticateDecantSplitRequest(request)
    if ("error" in auth) return auth.error

    const { splitId } = await context.params
    const { userId, formData } = auth

    const parsed = DecantSplitSlotActionSchema.safeParse({
      slotId: formData.get("slotId"),
    })
    if (!parsed.success) {
      return decantSplitRouteError(new Error("slotId is required"), "Validation failed")
    }

    const split = await claimDecantSplitSlot(splitId, parsed.data.slotId, userId)
    return createSuccessResponse({ split })
  } catch (error) {
    return decantSplitRouteError(error, "Failed to claim slot")
  }
}
