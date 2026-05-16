import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { getR2PublicUrl, uploadToR2 } from "@/lib/r2"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export const POST = async (request: NextRequest) => {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const formData = await request.formData()
    await requireCSRF(request, formData)

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Image file is required" },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: "Only JPEG, PNG, or WebP images are allowed" },
        { status: 400 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image must be 5 MB or smaller" },
        { status: 400 }
      )
    }

    const ext =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
    const key = `reports/${authResult.user!.id}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await uploadToR2(key, buffer, file.type)
    const url = getR2PublicUrl(key)

    return NextResponse.json({ success: true, url, key })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
