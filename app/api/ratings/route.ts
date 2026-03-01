import { NextRequest, NextResponse } from "next/server"
import {
  createPerfumeRating,
  getPerfumeRatings,
  getUserPerfumeRating,
  updatePerfumeRating,
} from "@/models/perfumeRating.server"
import {
  parseQueryParams,
  parseFormData,
  validateRating,
  validateRatingCategory,
} from "@/utils/server/api-route-helpers.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const perfumeId = params.required("perfumeId")
    const ratingsData = await getPerfumeRatings(perfumeId)
    return NextResponse.json(ratingsData)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ratings"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const formData = await parseFormData(request)
    const perfumeId = formData.required("perfumeId")
    const category = formData.required("category")
    const rating = formData.getInt("rating")

    validateRating(rating)
    validateRatingCategory(category)

    const existingRating = await getUserPerfumeRating(authResult.user!.id, perfumeId)
    if (existingRating) {
      await updatePerfumeRating(existingRating.id, { [category]: rating })
    } else {
      await createPerfumeRating({
        userId: authResult.user!.id,
        perfumeId,
        [category]: rating,
      })
    }
    return NextResponse.json({ message: "Rating saved successfully" })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : "Failed to save rating"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
