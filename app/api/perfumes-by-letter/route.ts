import { NextRequest, NextResponse } from "next/server"

import { getPerfumesByLetterPaginated } from "@/models/perfume.server"
import { clampPagination } from "@/utils/api-pagination.server"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const letter = sp.get("letter")
  const rawSkip = parseInt(sp.get("skip") || "0", 10)
  const rawTake = parseInt(sp.get("take") || "16", 10)
  const { skip, take } = clampPagination(isNaN(rawSkip) ? 0 : rawSkip, isNaN(rawTake) ? 16 : rawTake)
  if (!letter || !/^[A-Za-z]$/.test(letter)) {
    return NextResponse.json(
      { success: false, message: "Valid letter parameter is required", perfumes: [], count: 0, meta: {} },
      { status: 400 }
    )
  }
  try {
    const perfumes = await getPerfumesByLetterPaginated(letter.toUpperCase(), { skip, take })
    return NextResponse.json({
      success: true,
      perfumes: perfumes.perfumes,
      count: perfumes.count,
      meta: { letter, skip, take, hasMore: perfumes.perfumes.length === take, totalCount: perfumes.count },
    })
  } catch (error) {
    console.error("[api/perfumes-by-letter]", error)
    return NextResponse.json(
      { success: false, perfumes: [], count: 0, meta: {} },
      { status: 500 }
    )
  }
}
