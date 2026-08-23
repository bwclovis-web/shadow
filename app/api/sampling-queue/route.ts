import { NextRequest, NextResponse } from "next/server"
import type { SamplingQueueStatus } from "@prisma/client"

import {
  addToSamplingQueue,
  listSamplingQueue,
  removeFromSamplingQueue,
  updateSamplingQueueStatus,
} from "@/models/sampling-queue.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import { isFeatureEnabled } from "@/utils/feature-flags"

const STATUSES: SamplingQueueStatus[] = ["queued", "sampling", "completed", "skipped"]

export const GET = async (request: NextRequest) => {
  if (!isFeatureEnabled("samplingQueue")) {
    return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
  }
  const auth = await authenticateUser(request)
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
  }
  const items = await listSamplingQueue(auth.user!.id)
  return NextResponse.json({ success: true, items })
}

export const POST = async (request: NextRequest) => {
  try {
    if (!isFeatureEnabled("samplingQueue")) {
      return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
    }
    const auth = await authenticateUser(request)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
    }
    const body = await request.json()
    await requireCSRFForJsonBody(request, body)
    const intent = body?.intent ?? "add"

    if (intent === "remove") {
      const id = typeof body?.id === "string" ? body.id : ""
      await removeFromSamplingQueue(auth.user!.id, id)
      return NextResponse.json({ success: true })
    }

    if (intent === "update-status") {
      const id = typeof body?.id === "string" ? body.id : ""
      const status = body?.status as SamplingQueueStatus
      if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      await updateSamplingQueueStatus({
        userId: auth.user!.id,
        id,
        status,
        notes: typeof body?.notes === "string" ? body.notes : undefined,
      })
      return NextResponse.json({ success: true })
    }

    const perfumeId = typeof body?.perfumeId === "string" ? body.perfumeId.trim() : ""
    if (!isValidPrismaRecordId(perfumeId)) {
      return NextResponse.json({ error: "Invalid perfumeId" }, { status: 400 })
    }
    const item = await addToSamplingQueue({
      userId: auth.user!.id,
      perfumeId,
      notes: typeof body?.notes === "string" ? body.notes : null,
    })
    return NextResponse.json({ success: true, item })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Response) return error
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
