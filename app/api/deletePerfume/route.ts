import { NextRequest, NextResponse } from "next/server"

import { deletePerfume } from "@/models/perfume.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

const BAD_REQUEST = { success: false, message: "Invalid request" } as const
const SERVER_ERROR = { success: false, message: "Operation failed" } as const

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  const id = request.nextUrl.searchParams.get("id") ?? undefined
  if (!id?.trim()) {
    return NextResponse.json(BAD_REQUEST, { status: 400 })
  }

  try {
    await deletePerfume(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api/deletePerfume]", error)
    return NextResponse.json(SERVER_ERROR, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405 })
}
