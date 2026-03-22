import { NextRequest, NextResponse } from "next/server"

import { COMPARE_MAX_ITEMS } from "@/constants/compare"
import { getComparePersonalization } from "@/models/compare-personalize.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { compareIdsExceedMax, normalizeCompareIds } from "@/utils/compare-ids"

export const dynamic = "force-dynamic"

function parseIdsFromRequest(request: NextRequest): string[] {
  const { searchParams } = request.nextUrl
  const repeated = searchParams.getAll("ids").flatMap((s) => s.split(","))
  const single = searchParams.get("ids")
  const raw = repeated.length > 0 ? repeated : single ? single.split(",") : []
  return normalizeCompareIds(raw)
}

export const GET = async (request: NextRequest) => {
  const auth = await authenticateUser(request)
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: auth.status ?? 401 }
    )
  }

  const ids = parseIdsFromRequest(request)

  if (ids.length === 0) {
    return NextResponse.json({
      winnerId: null,
      explainNotes: [],
    })
  }

  if (compareIdsExceedMax(ids)) {
    return NextResponse.json(
      { error: `At most ${COMPARE_MAX_ITEMS} perfumes can be compared` },
      { status: 400 }
    )
  }

  try {
    const result = await getComparePersonalization(auth.user.id, ids)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/compare/personalize]", error)
    return NextResponse.json(
      { error: "Failed to load personalization" },
      { status: 500 }
    )
  }
}
