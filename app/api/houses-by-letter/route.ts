import { NextRequest, NextResponse } from "next/server"
import { getHousesByLetter } from "@/models/house.server"

export async function GET(request: NextRequest) {
  const letter = request.nextUrl.searchParams.get("letter")
  if (!letter || !/^[A-Za-z]$/.test(letter)) {
    return NextResponse.json(
      { success: false, message: "Valid letter parameter is required", houses: [] },
      { status: 400 }
    )
  }
  try {
    const houses = await getHousesByLetter(letter.toUpperCase())
    return NextResponse.json({ success: true, houses, count: houses.length })
  } catch (error) {
    console.error("[api/houses-by-letter]", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch houses", houses: [] },
      { status: 500 }
    )
  }
}
