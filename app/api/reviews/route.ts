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
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import { containsDangerousReviewHtml } from "@/utils/sanitize"
import { validateRateLimit } from "@/utils/api-validation.server"
import { getUserMutationRateLimits } from "@/utils/rate-limit-config.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    const params = parseQueryParams(request)
    const pagination = parsePaginationParams(request)
    const perfumeId = (params.get("perfumeId") ?? "").trim()
    const userId = (params.get("userId") ?? "").trim()
    if (!perfumeId && !userId) {
      return NextResponse.json({ error: "Either perfumeId or userId is required" }, { status: 400 })
    }
    if (perfumeId && !isValidPrismaRecordId(perfumeId)) {
      return NextResponse.json({ error: "Invalid perfume ID" }, { status: 400 })
    }
    if (userId && !isValidPrismaRecordId(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }
    const filters: Record<string, unknown> = {}
    if (perfumeId) filters.perfumeId = perfumeId
    if (userId) filters.userId = userId

    const isApprovedParam = params.get("isApproved")
    if (isApprovedParam !== null) {
      const wantsApproved = params.getBoolean("isApproved")
      if (!wantsApproved) {
        if (!authResult.success || !authResult.user) {
          return NextResponse.json({ error: "Authentication required" }, { status: 401 })
        }
        if (authResult.user.role !== "admin" && authResult.user.role !== "editor") {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }
        filters.isApproved = false
      } else {
        filters.isApproved = true
      }
    } else {
      filters.isApproved = true
    }

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

    const mutationLimits = getUserMutationRateLimits()
    try {
      await validateRateLimit(
        `reviews:post:${auth.userId}`,
        mutationLimits.reviewsPost.max,
        mutationLimits.reviewsPost.windowMs
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) {
        return rateLimitResponse
      }
      throw rateLimitResponse
    }

    const action = formData.required("_action")

    switch (action) {
      case "create": {
        const perfumeId = formData.required("perfumeId").trim()
        if (!isValidPrismaRecordId(perfumeId)) {
          return NextResponse.json({ error: "Invalid perfume ID" }, { status: 400 })
        }
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
        const reviewId = formData.required("reviewId").trim()
        if (!isValidPrismaRecordId(reviewId)) {
          return NextResponse.json({ error: "Invalid review ID" }, { status: 400 })
        }
        const review = formData.required("review")
        if (containsDangerousReviewHtml(review)) {
          return NextResponse.json({ error: "Reviews cannot contain scripts or embedded content." }, { status: 400 })
        }
        const updatedReview = await updatePerfumeReview(reviewId, { review }, auth.userId)
        return NextResponse.json({ success: true, message: "Review updated successfully", data: updatedReview })
      }
      case "delete": {
        const reviewId = formData.required("reviewId").trim()
        if (!isValidPrismaRecordId(reviewId)) {
          return NextResponse.json({ error: "Invalid review ID" }, { status: 400 })
        }
        await deletePerfumeReview(reviewId, auth.userId, auth.user.role)
        return NextResponse.json({ success: true, message: "Review deleted successfully" })
      }
      case "moderate": {
        if (auth.user.role !== "admin" && auth.user.role !== "editor") {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }
        const reviewId = formData.required("reviewId").trim()
        if (!isValidPrismaRecordId(reviewId)) {
          return NextResponse.json({ error: "Invalid review ID" }, { status: 400 })
        }
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
