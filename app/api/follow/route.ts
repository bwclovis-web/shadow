import { NextRequest, NextResponse } from "next/server"

import {
  follow,
  getFollowerCountForUser,
  unfollow,
  type FollowTargetType,
} from "@/models/user-follow.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { createSuccessResponse } from "@/utils/response.server"
import { parseFormData } from "@/utils/server/api-route-helpers.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { FollowActionSchema } from "@/utils/validation/formValidationSchemas"

const FOLLOW_RATE_LIMIT = { max: 60, windowMs: 60 * 60 * 1000 }

export const POST = async (request: NextRequest) => {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const formData = await parseFormData(request)
    await requireCSRF(request, formData)

    const parsed = FollowActionSchema.safeParse({
      action: formData.get("action"),
      targetType: formData.get("targetType"),
      targetId: formData.get("targetId"),
    })

    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message =
        first.targetId?.[0] ??
        first.targetType?.[0] ??
        first.action?.[0] ??
        "Validation failed"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const followerId = authResult.user!.id
    const { action, targetType, targetId } = parsed.data

    try {
      await validateRateLimit(
        `follow:user:${followerId}`,
        FOLLOW_RATE_LIMIT.max,
        FOLLOW_RATE_LIMIT.windowMs
      )
    } catch (rateLimitResponse) {
      if (rateLimitResponse instanceof Response) {
        return rateLimitResponse
      }
      throw rateLimitResponse
    }

    const typedTarget = targetType as FollowTargetType

    if (action === "follow") {
      const result = await follow(followerId, typedTarget, targetId)
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
      const payload: Record<string, unknown> = { following: true }
      if (typedTarget === "user") {
        payload.followerCount = await getFollowerCountForUser(targetId)
      }
      return createSuccessResponse(payload)
    }

    const result = await unfollow(followerId, typedTarget, targetId)
    const payload: Record<string, unknown> = { following: result.following }
    if (typedTarget === "user") {
      payload.followerCount = await getFollowerCountForUser(targetId)
    }
    return createSuccessResponse(payload)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    console.error("Follow API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
