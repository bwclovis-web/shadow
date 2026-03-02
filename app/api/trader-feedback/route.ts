import { NextRequest, NextResponse } from "next/server"
import {
  getTraderFeedbackForProfile,
  removeTraderFeedback,
  submitTraderFeedback,
  getTraderFeedbackSummary,
} from "@/models/traderFeedback.server"
import {
  parseFormData,
  parsePaginationParams,
  parseQueryParams,
} from "@/utils/server/api-route-helpers.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const pagination = parsePaginationParams(request)
    const traderId = params.required("traderId")
    const includeComments = params.getBoolean("includeComments")
    const viewerId = params.get("viewerId")

    const { summary, comments, viewerFeedback } = await getTraderFeedbackForProfile(
      traderId,
      viewerId && viewerId !== traderId ? viewerId : null,
      {
        includeList: includeComments,
        ...(includeComments && {
          listLimit: pagination.limit,
          listOffset: pagination.skip,
        }),
      }
    )

    return NextResponse.json({ success: true, summary, comments, viewerFeedback })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch feedback"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status ?? 401 })
    }
    const formData = await parseFormData(request)
    await requireCSRF(request, formData)
    const intent = formData.required("_action")

    if (intent === "submit") {
      const traderId = formData.required("traderId")
      const rating = formData.getInt("rating")
      const comment = formData.get("comment")
      if (!rating) {
        return NextResponse.json({ error: "Rating is required" }, { status: 400 })
      }
      const feedback = await submitTraderFeedback({
        traderId,
        reviewerId: authResult.user!.id,
        rating,
        comment,
      })
      const summary = await getTraderFeedbackSummary(traderId)
      return NextResponse.json({ success: true, message: "Feedback submitted", data: { feedback, summary } })
    }

    if (intent === "remove") {
      const traderId = formData.required("traderId")
      await removeTraderFeedback(traderId, authResult.user!.id)
      return NextResponse.json({ success: true, message: "Feedback removed" })
    }

    return NextResponse.json({ error: `Invalid action: ${intent}` }, { status: 400 })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const msg = error instanceof Error ? error.message : "Failed to process feedback"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
