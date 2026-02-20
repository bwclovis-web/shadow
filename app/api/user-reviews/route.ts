import { NextRequest, NextResponse } from "next/server"
import { getPendingReviews, getUserReviews } from "@/models/perfumeReview.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status ?? 401 })
    }
    const user = authResult.user!
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10)
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10", 10)
    const type = request.nextUrl.searchParams.get("type")

    if (type === "pending") {
      if (user.role !== "admin" && user.role !== "editor") {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }
      return NextResponse.json(await getPendingReviews({ page, limit }))
    }
    return NextResponse.json(await getUserReviews(user.id, { page, limit }))
  } catch (error) {
    console.error("[api/user-reviews]", error)
    return NextResponse.json({ error: "Failed to fetch user reviews" }, { status: 500 })
  }
}
