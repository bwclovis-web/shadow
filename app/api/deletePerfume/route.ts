import { NextRequest, NextResponse } from "next/server"
import { deletePerfume } from "@/models/perfume.server"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json([], { status: 400 })
  try {
    const result = await deletePerfume(id)
    return NextResponse.json(result ?? [])
  } catch (error) {
    console.error("[api/deletePerfume]", error)
    return NextResponse.json([], { status: 500 })
  }
}
