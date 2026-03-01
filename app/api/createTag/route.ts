import { NextRequest, NextResponse } from "next/server"

import { createTag } from "@/models/tags.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

const BAD_REQUEST = { success: false, message: "Invalid request" } as const
const SERVER_ERROR = { success: false, message: "Operation failed" } as const

export async function POST(request: NextRequest) {
  try {
    await requireCSRF(request)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 403 })
    }
    throw error
  }
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  let tag: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    const raw = (body.tag ?? body.name) as string | undefined
    if (typeof raw === "string" && raw.trim()) tag = raw.trim()
  } catch {
    // body was not JSON; allow query as fallback for form submissions
  }
  if (!tag) {
    tag = request.nextUrl.searchParams.get("tag")?.trim() ?? null
  }
  if (!tag) {
    return NextResponse.json(BAD_REQUEST, { status: 400 })
  }

  try {
    const result = await createTag(tag)
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.reason }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: { id: result.tag.id, name: result.tag.name } })
  } catch (error) {
    console.error("[api/createTag]", error)
    return NextResponse.json(SERVER_ERROR, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405 })
}
