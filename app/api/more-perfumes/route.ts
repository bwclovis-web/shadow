import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { clampPagination } from "@/utils/api-pagination.server"
import {
  normalizeHousePerfumeNameSearch,
  parseHousePerfumeSortByParam,
} from "@/utils/house-perfumes-url-params"
import {
  buildHousePerfumesOrderBy,
  buildPerfumesWhereForHouse,
} from "@/utils/server/house-perfumes-query.server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const houseSlug = searchParams.get("houseSlug")
  const rawSkip = parseInt(searchParams.get("skip") || "0", 10)
  const rawTake = parseInt(searchParams.get("take") || "8", 10)
  const { skip, take } = clampPagination(isNaN(rawSkip) ? 0 : rawSkip, isNaN(rawTake) ? 8 : rawTake)
  const sortBy = parseHousePerfumeSortByParam(searchParams.get("sortBy"))
  const nameSearch = normalizeHousePerfumeNameSearch(searchParams.get("q"))

  if (!houseSlug) {
    return NextResponse.json(
      { success: false, message: "House slug is required", perfumes: [] },
      { status: 400 }
    )
  }
  try {
    const house = await prisma.perfumeHouse.findUnique({
      where: { slug: houseSlug },
      select: { id: true, name: true },
    })
    if (!house) {
      return NextResponse.json(
        { success: false, message: "House not found", perfumes: [] },
        { status: 404 }
      )
    }

    const perfumeWhere = buildPerfumesWhereForHouse(house.id, nameSearch)
    const orderBy = buildHousePerfumesOrderBy(sortBy)

    const [perfumes, totalCount] = await Promise.all([
      prisma.perfume.findMany({
        where: perfumeWhere,
        orderBy,
        skip,
        take,
      }),
      prisma.perfume.count({ where: perfumeWhere }),
    ])

    const hasMore = skip + perfumes.length < totalCount
    return NextResponse.json(
      {
        success: true,
        perfumes,
        meta: {
          houseName: house.name,
          skip,
          take,
          hasMore,
          count: perfumes.length,
          totalCount,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Data-Size": JSON.stringify(perfumes).length.toString(),
        },
      }
    )
  } catch (error) {
    console.error("[api/more-perfumes]", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch perfumes", perfumes: [] },
      { status: 500 }
    )
  }
}
