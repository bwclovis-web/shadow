import { NextRequest, NextResponse } from "next/server"
import type { RecommendationFeedbackAction } from "@prisma/client"

import { submitRecommendationFeedback } from "@/models/recommendation-feedback.server"
import { addToSamplingQueue } from "@/models/sampling-queue.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import { isFeatureEnabled } from "@/utils/feature-flags"

const ACTIONS: RecommendationFeedbackAction[] = [
  "not_for_me",
  "already_own",
  "sampled",
  "more_like_this",
]

export const POST = async (request: NextRequest) => {
  try {
    if (!isFeatureEnabled("recommendationFeedback")) {
      return NextResponse.json({ error: "Feature disabled" }, { status: 404 })
    }
    const auth = await authenticateUser(request)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
    }
    const body = await request.json()
    await requireCSRFForJsonBody(request, body)
    const perfumeId = typeof body?.perfumeId === "string" ? body.perfumeId.trim() : ""
    const action = body?.action as RecommendationFeedbackAction
    if (!isValidPrismaRecordId(perfumeId)) {
      return NextResponse.json({ error: "Invalid perfumeId" }, { status: 400 })
    }
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const feedback = await submitRecommendationFeedback({
      userId: auth.user!.id,
      perfumeId,
      action,
      source: typeof body?.source === "string" ? body.source : null,
    })

    if (action === "sampled") {
      await addToSamplingQueue({ userId: auth.user!.id, perfumeId })
    }

    return NextResponse.json({ success: true, feedback })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof Response) return error
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
