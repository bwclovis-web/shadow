import { NextRequest, NextResponse } from "next/server"

import { getPerfumeBySlug } from "@/models/perfume.server"

export const dynamic = "force-dynamic"

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) => {
  const { slug } = await params
  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 })
  }
  try {
    const perfume = await getPerfumeBySlug(slug)
    if (!perfume) {
      return NextResponse.json({ error: "Perfume not found" }, { status: 404 })
    }
    return NextResponse.json({ perfume })
  } catch (error) {
    console.error("[api/perfume/[slug]]", error)
    return NextResponse.json(
      { error: "Failed to fetch perfume" },
      { status: 500 }
    )
  }
}
