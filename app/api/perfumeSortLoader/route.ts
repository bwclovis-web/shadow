import { NextRequest, NextResponse } from "next/server"
import { getAllPerfumesWithOptions } from "@/models/perfume.server"

export async function GET(request: NextRequest) {
  const sortBy = request.nextUrl.searchParams.get("sortBy")
  try {
    const result = await getAllPerfumesWithOptions({
      sortBy: sortBy as
        | "name-asc"
        | "name-desc"
        | "created-desc"
        | "created-asc"
        | "type-asc"
        | undefined,
    })
    return NextResponse.json(result ?? [])
  } catch (error) {
    console.error("[api/perfumeSortLoader]", error)
    return NextResponse.json([], { status: 500 })
  }
}
