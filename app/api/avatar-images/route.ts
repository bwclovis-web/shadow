import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { getR2PublicUrl, uploadToR2 } from "@/lib/r2"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { validateUploadedImage } from "@/utils/server/validate-image-upload.server"

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

    const validated = await validateUploadedImage(file, ALLOWED_TYPES)
    if (!validated.ok) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 })
    }

    const ext =
      validated.mime === "image/png" ? "png" : validated.mime === "image/webp" ? "webp" : "jpg"
    const key = `avatars/${authResult.user!.id}/${randomUUID()}.${ext}`

    await uploadToR2(key, validated.buffer, validated.mime)
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
