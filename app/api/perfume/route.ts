import { NextRequest, NextResponse } from "next/server"
import { searchPerfumeByName } from "@/models/perfume.server"
import { parseOptionalAutocompleteQuery } from "@/utils/server/api-route-helpers.server"

export async function GET(request: NextRequest) {
  const name = parseOptionalAutocompleteQuery(
    request.nextUrl.searchParams.get("name")
  )
  if (!name) {
    return NextResponse.json([])
  }
  try {
    const result = await searchPerfumeByName(name)
    return NextResponse.json(result ?? [])
  } catch (error) {
    console.error("[api/perfume]", error)
    return NextResponse.json([], { status: 500 })
  }
}
