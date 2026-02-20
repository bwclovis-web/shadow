import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const houseSlug = searchParams.get("houseSlug")
  const skip = parseInt(searchParams.get("skip") || "0", 10)
  const take = parseInt(searchParams.get("take") || "8", 10)

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

    const [perfumes, totalCount] = await Promise.all([
      prisma.perfume.findMany({
        where: { perfumeHouseId: house.id },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.perfume.count({ where: { perfumeHouseId: house.id } }),
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
