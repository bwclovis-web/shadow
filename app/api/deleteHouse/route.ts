import { NextRequest, NextResponse } from "next/server"

import { deletePerfumeHouse } from "@/models/house.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

const BAD_REQUEST = { success: false, message: "Invalid request" } as const
const SERVER_ERROR = { success: false, message: "Operation failed" } as const

export async function DELETE(request: NextRequest) {
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

  const id = request.nextUrl.searchParams.get("id") ?? undefined
  if (!id?.trim()) {
    return NextResponse.json(BAD_REQUEST, { status: 400 })
  }

  try {
    await deletePerfumeHouse(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api/deleteHouse]", error)
    return NextResponse.json(SERVER_ERROR, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405 })
}
