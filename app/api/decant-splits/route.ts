import { NextRequest, NextResponse } from "next/server"

import { createDecantSplit } from "@/models/decant-split.server"
import {
  authenticateDecantSplitRequest,
  decantSplitRouteError,
} from "@/utils/decant-split-api-route.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { createSuccessResponse } from "@/utils/response.server"
import { CreateDecantSplitSchema } from "@/utils/validation/formValidationSchemas"

export const POST = async (request: NextRequest) => {
  try {
    const auth = await authenticateDecantSplitRequest(request)
    if ("error" in auth) return auth.error

    const { userId, formData } = auth

    await validateRateLimit(`decant-split-create:user:${userId}`, 10, 60 * 60 * 1000)

    const parsed = CreateDecantSplitSchema.safeParse({
      perfumeId: formData.get("perfumeId"),
      sourceUserPerfumeId: formData.get("sourceUserPerfumeId") ?? undefined,
      totalMl: formData.get("totalMl"),
      slotMl: formData.get("slotMl"),
      priceHint: formData.get("priceHint") ?? undefined,
      notes: formData.get("notes") ?? undefined,
      decantFormat: formData.get("decantFormat") ?? undefined,
      condition: formData.get("condition") ?? undefined,
    })

    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message =
        first.slotMl?.[0] ??
        first.totalMl?.[0] ??
        first.perfumeId?.[0] ??
        "Validation failed"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const data = parsed.data
    const split = await createDecantSplit({
      hostUserId: userId,
      perfumeId: data.perfumeId,
      sourceUserPerfumeId: data.sourceUserPerfumeId ?? null,
      totalMl: data.totalMl,
      slotMl: data.slotMl,
      priceHint: data.priceHint ?? null,
      notes: data.notes ?? null,
      decantFormat: data.decantFormat ?? null,
      condition: data.condition ?? null,
    })

    return createSuccessResponse({ split })
  } catch (error) {
    return decantSplitRouteError(error, "Failed to create decant split")
  }
}
