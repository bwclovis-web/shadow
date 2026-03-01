import { NextRequest, NextResponse } from "next/server"
import {
  createPerfumeReview,
  deletePerfumeReview,
  getPerfumeReviews,
  getUserPerfumeReview,
  moderatePerfumeReview,
  updatePerfumeReview,
} from "@/models/perfumeReview.server"
import {
  parseFormData,
  parsePaginationParams,
  parseQueryParams,
} from "@/utils/server/api-route-helpers.server"
import { containsDangerousReviewHtml } from "@/utils/sanitize"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const pagination = parsePaginationParams(request)
    const perfumeId = params.get("perfumeId")
    const userId = params.get("userId")
    if (!perfumeId && !userId) {
      return NextResponse.json({ error: "Either perfumeId or userId is required" }, { status: 400 })
    }
    const filters: Record<string, unknown> = {}
    if (perfumeId) filters.perfumeId = perfumeId
    if (userId) filters.userId = userId
    const isApproved = params.get("isApproved")
    if (isApproved !== null) filters.isApproved = params.getBoolean("isApproved")

    const result = await getPerfumeReviews(perfumeId || "", filters, {
      page: pagination.page,
      limit: pagination.limit,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch reviews"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status ?? 401 })
    }
    const auth = { userId: authResult.user!.id, user: authResult.user! }
    const formData = await parseFormData(request)
    await requireCSRF(request, formData)
    const action = formData.required("_action")

    switch (action) {
      case "create": {
        const perfumeId = formData.required("perfumeId")
        const review = formData.required("review")
        if (containsDangerousReviewHtml(review)) {
          return NextResponse.json({ error: "Reviews cannot contain scripts or embedded content." }, { status: 400 })
        }
        const existingReview = await getUserPerfumeReview(auth.userId, perfumeId)
        if (existingReview) {
          return NextResponse.json({ error: "You have already reviewed this perfume" }, { status: 400 })
        }
        const newReview = await createPerfumeReview({ userId: auth.userId, perfumeId, review })
        return NextResponse.json({ success: true, message: "Review created successfully", data: newReview })
      }
      case "update": {
        const reviewId = formData.required("reviewId")
        const review = formData.required("review")
        if (containsDangerousReviewHtml(review)) {
          return NextResponse.json({ error: "Reviews cannot contain scripts or embedded content." }, { status: 400 })
        }
        const updatedReview = await updatePerfumeReview(reviewId, { review }, auth.userId)
        return NextResponse.json({ success: true, message: "Review updated successfully", data: updatedReview })
      }
      case "delete": {
        const reviewId = formData.required("reviewId")
        await deletePerfumeReview(reviewId, auth.userId, auth.user.role)
        return NextResponse.json({ success: true, message: "Review deleted successfully" })
      }
      case "moderate": {
        if (auth.user.role !== "admin" && auth.user.role !== "editor") {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }
        const reviewId = formData.required("reviewId")
        const isApproved = formData.getBoolean("isApproved")
        const moderatedReview = await moderatePerfumeReview(reviewId, isApproved)
        return NextResponse.json({ success: true, message: "Review moderated successfully", data: moderatedReview })
      }
      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const msg = error instanceof Error ? error.message : "Failed to process request"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
