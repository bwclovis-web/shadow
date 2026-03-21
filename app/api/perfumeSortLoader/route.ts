/**
 * GET /api/perfumeSortLoader
 *
 * Query: `sortBy` (optional, allowlisted), `take` (optional, clamped server-side),
 * `cursor` (optional, perfume id — next page after this row).
 * Response: `{ perfumes, nextCursor }` (cursor pagination).
 */

import { NextRequest, NextResponse } from "next/server"

import { getAllPerfumesWithOptions } from "@/models/perfume.server"
import { isValidPrismaRecordId } from "@/utils/prisma-record-id"
import {
  isPerfumeListSortBy,
  type PerfumeListSortBy,
} from "@/utils/server/perfume-cursor-order.server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  let sortBy: PerfumeListSortBy | undefined
  const sortByParam = searchParams.get("sortBy")
  if (sortByParam !== null && sortByParam !== "") {
    if (!isPerfumeListSortBy(sortByParam)) {
      return NextResponse.json({ error: "Invalid sortBy" }, { status: 400 })
    }
    sortBy = sortByParam
  }

  const cursorParam = searchParams.get("cursor")
  if (cursorParam && !isValidPrismaRecordId(cursorParam)) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 })
  }

  let take: number | undefined
  const takeRaw = searchParams.get("take")
  if (takeRaw !== null && takeRaw !== "") {
    const n = parseInt(takeRaw, 10)
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: "Invalid take" }, { status: 400 })
    }
    take = n
  }

  try {
    const { items, nextCursor } = await getAllPerfumesWithOptions({
      sortBy,
      take,
      cursor: cursorParam ?? undefined,
    })
    return NextResponse.json({ perfumes: items, nextCursor })
  } catch (error) {
    console.error("[api/perfumeSortLoader]", error)
    return NextResponse.json(
      { perfumes: [], nextCursor: null },
      { status: 500 }
    )
  }
}
