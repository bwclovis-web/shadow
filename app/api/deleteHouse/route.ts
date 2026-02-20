import { NextRequest, NextResponse } from "next/server"
import { deletePerfumeHouse } from "@/models/house.server"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json([], { status: 400 })
  try {
    const result = await deletePerfumeHouse(id)
    return NextResponse.json(result ?? [])
  } catch (error) {
    console.error("[api/deleteHouse]", error)
    return NextResponse.json([], { status: 500 })
  }
}
