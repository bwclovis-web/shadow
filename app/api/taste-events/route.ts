import { NextRequest, NextResponse } from "next/server"
import type { TasteEventType } from "@prisma/client"

import {
  listTasteEventsForUser,
  recordTasteEvent,
} from "@/models/taste-event.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"

const ALLOWED: TasteEventType[] = [
  "quiz_answer",
  "rating",
  "dislike",
  "skip_recommendation",
  "owned",
  "wishlist",
  "sample_outcome",
  "wear",
  "season_pref",
  "budget_pref",
  "projection_pref",
  "longevity_pref",
  "compare",
]

export const GET = async (request: NextRequest) => {
  const auth = await authenticateUser(request)
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
  }
  const events = await listTasteEventsForUser(auth.user!.id)
  return NextResponse.json({ success: true, events })
}

export const POST = async (request: NextRequest) => {
  try {
    const auth = await authenticateUser(request)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
    }
    const body = await request.json()
    await requireCSRFForJsonBody(request, body)
    const eventType = body?.eventType as TasteEventType
    if (!ALLOWED.includes(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 })
    }
    const perfumeId =
      typeof body?.perfumeId === "string" && body.perfumeId.trim()
        ? body.perfumeId.trim()
        : null
    if (perfumeId && !isValidPrismaRecordId(perfumeId)) {
      return NextResponse.json({ error: "Invalid perfumeId" }, { status: 400 })
    }
    const event = await recordTasteEvent({
      userId: auth.user!.id,
      eventType,
      perfumeId,
      weight: typeof body?.weight === "number" ? body.weight : 1,
      metadata: body?.metadata ?? undefined,
    })
    return NextResponse.json({ success: true, event })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Response) return error
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
