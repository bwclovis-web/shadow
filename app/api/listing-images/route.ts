import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { getR2PublicUrl, uploadToR2 } from "@/lib/r2"
import { validateRateLimit } from "@/utils/api-validation.server"
import { getUserMutationRateLimits } from "@/utils/rate-limit-config.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { getClientIdentifier } from "@/utils/server/request.server"
import { safeJsonError } from "@/utils/server/safe-error.server"
import { validateUploadedImage } from "@/utils/server/validate-image-upload.server"
import { logSecurityAudit } from "@/utils/security/security-audit.server"
import {
  getTurnstileTokenFromFormData,
  verifyTurnstileToken,
} from "@/utils/security/turnstile.server"

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

    const limits = getUserMutationRateLimits().fileUpload
    await validateRateLimit(
      `file-upload:listing:${authResult.user!.id}:${getClientIdentifier(request)}`,
      limits.max,
      limits.windowMs
    )

    const formData = await request.formData()
    await requireCSRF(request, formData)

    const turnstile = await verifyTurnstileToken(
      getTurnstileTokenFromFormData(formData),
      getClientIdentifier(request)
    )
    if (!turnstile.ok) {
      return NextResponse.json({ success: false, error: turnstile.error }, { status: 400 })
    }

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

    const key = `listings/${authResult.user!.id}/${randomUUID()}.webp`

    const storedKey = await uploadToR2(key, validated.buffer)
    const url = getR2PublicUrl(storedKey)

    void logSecurityAudit({
      userId: authResult.user!.id,
      action: "FILE_UPLOAD",
      severity: "info",
      resource: "ListingImage",
      resourceId: storedKey,
      ipAddress: getClientIdentifier(request),
      userAgent: request.headers.get("user-agent"),
      details: { bytes: validated.buffer.byteLength, mime: "image/webp", sourceMime: validated.mime },
    })

    return NextResponse.json({ success: true, url, key: storedKey })
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    return safeJsonError({ cause: error, publicMessage: "Upload failed" })
  }
}
