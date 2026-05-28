import { NextRequest, NextResponse } from "next/server"
import { searchPerfumeByNameForViewer } from "@/models/perfume.server"
import { getSessionFromRequest } from "@/utils/session-from-request.server"
import { parseOptionalAutocompleteQuery } from "@/utils/server/api-route-helpers.server"

export async function GET(request: NextRequest) {
  const name = parseOptionalAutocompleteQuery(
    request.nextUrl.searchParams.get("name")
  )
  if (!name) {
    return NextResponse.json([])
  }
  try {
    const session = await getSessionFromRequest(request, { includeUser: false })
    const result = await searchPerfumeByNameForViewer(name, {
      viewerUserId: session?.userId,
    })
    return NextResponse.json(result ?? [])
  } catch (error) {
    console.error("[api/perfume]", error)
    return NextResponse.json([], { status: 500 })
  }
}
