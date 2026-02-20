import { NextRequest, NextResponse } from "next/server"
import { createTag } from "@/models/tags.server"

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get("tag")
  if (!tag) {
    return NextResponse.json([], { status: 400 })
  }
  try {
    const result = await createTag(tag)
    return NextResponse.json(result ? result : [])
  } catch (error) {
    console.error("[api/createTag]", error)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const tag = (body.tag ?? request.nextUrl.searchParams.get("tag")) as string | null
  if (!tag) {
    return NextResponse.json([], { status: 400 })
  }
  try {
    const result = await createTag(tag)
    return NextResponse.json(result ?? [])
  } catch (error) {
    console.error("[api/createTag]", error)
    return NextResponse.json([], { status: 500 })
  }
}
