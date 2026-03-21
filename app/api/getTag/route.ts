import { NextRequest, NextResponse } from "next/server"
import { getTagsByName } from "@/models/tags.server"
import { parseRequiredAutocompleteQuery } from "@/utils/server/api-route-helpers.server"

export async function GET(request: NextRequest) {
  const tag = parseRequiredAutocompleteQuery(
    request.nextUrl.searchParams.get("tag")
  )
  if (!tag) return NextResponse.json([], { status: 400 })
  try {
    const result = await getTagsByName(tag)
    return NextResponse.json(result ?? [])
  } catch (error) {
    console.error("[api/getTag]", error)
    return NextResponse.json([], { status: 500 })
  }
}
