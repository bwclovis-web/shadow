import { NextRequest, NextResponse } from "next/server"

import { COMPARE_MAX_ITEMS } from "@/constants/compare"
import {
  compareIdsExceedMax,
  getComparePayload,
  normalizeCompareIds,
} from "@/models/compare.server"

export const dynamic = "force-dynamic"

function parseIdsFromRequest(request: NextRequest): string[] {
  const { searchParams } = request.nextUrl
  const repeated = searchParams.getAll("ids").flatMap((s) => s.split(","))
  const single = searchParams.get("ids")
  const raw = repeated.length > 0 ? repeated : single ? single.split(",") : []
  return normalizeCompareIds(raw)
}

export const GET = async (request: NextRequest) => {
  const ids = parseIdsFromRequest(request)

  if (ids.length === 0) {
    return NextResponse.json({ perfumes: [] satisfies unknown[] })
  }

  if (compareIdsExceedMax(ids)) {
    return NextResponse.json(
      { error: `At most ${COMPARE_MAX_ITEMS} perfumes can be compared` },
      { status: 400 }
    )
  }

  try {
    const perfumes = await getComparePayload(ids)
    return NextResponse.json({ perfumes })
  } catch (error) {
    console.error("[api/compare]", error)
    return NextResponse.json(
      { error: "Failed to load compare data" },
      { status: 500 }
    )
  }
}
