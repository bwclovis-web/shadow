import { NextRequest, NextResponse } from "next/server"

import {
  clearHelpfulnessVote,
  upsertHelpfulnessVote,
  type HelpfulnessVoteValue,
} from "@/models/traderFeedbackHelpfulness.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import { getUserMutationRateLimits } from "@/utils/rate-limit-config.server"
import { parseFormData } from "@/utils/server/api-route-helpers.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"

const parseVoteValue = (raw: string | null | undefined): HelpfulnessVoteValue | null => {
  const v = raw?.trim().toLowerCase()
  if (!v) return null
  if (v === "helpful" || v === "unhelpful") return v
  throw new Error('value must be "helpful" or "unhelpful"')
}

export const POST = async (request: NextRequest) => {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const formData = await parseFormData(request)
    await requireCSRF(request, formData)

    const mutationLimits = getUserMutationRateLimits()
    try {
      await validateRateLimit(
        `feedback-votes:post:${authResult.user!.id}`,
        mutationLimits.feedbackVotesPost.max,
        mutationLimits.feedbackVotesPost.windowMs
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) {
        return rateLimitResponse
      }
      throw rateLimitResponse
    }

    const feedbackId = formData.required("feedbackId").trim()
    if (!isValidPrismaRecordId(feedbackId)) {
      return NextResponse.json({ error: "Invalid feedback ID" }, { status: 400 })
    }

    const valueRaw = formData.get("value")
    const value = parseVoteValue(valueRaw)

    const aggregate = value
      ? await upsertHelpfulnessVote(feedbackId, authResult.user!.id, value)
      : await clearHelpfulnessVote(feedbackId, authResult.user!.id)

    return NextResponse.json({
      success: true,
      feedbackId,
      ...aggregate,
    })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message =
      error instanceof Error ? error.message : "Failed to save feedback vote"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
