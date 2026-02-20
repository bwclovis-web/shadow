import { NextRequest, NextResponse } from "next/server"
import { getHousesByLetterPaginated } from "@/models/house.server"
import { ErrorHandler } from "@/utils/errorHandling"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const letter = searchParams.get("letter")
  const houseType = searchParams.get("houseType") || "all"
  const skip = parseInt(searchParams.get("skip") || "0", 10)
  const take = parseInt(searchParams.get("take") || "16", 10)

  if (!letter || !/^[A-Za-z]$/.test(letter)) {
    return NextResponse.json(
      { success: false, message: "Valid letter parameter is required", houses: [] },
      { status: 400 }
    )
  }
  try {
    const houses = await getHousesByLetterPaginated(letter.toUpperCase(), {
      skip,
      take,
      houseType,
    })
    return NextResponse.json({
      success: true,
      houses: houses.houses,
      count: houses.count,
      meta: {
        letter,
        houseType,
        skip,
        take,
        hasMore: skip + houses.houses.length < houses.count,
        totalCount: houses.count,
      },
    })
  } catch (error) {
    const appError = ErrorHandler.handle(error, {
      api: "houses-by-letter-paginated",
      letter,
      houseType,
      skip,
      take,
    })
    return NextResponse.json(
      { success: false, message: appError.userMessage, houses: [] },
      { status: 500 }
    )
  }
}
