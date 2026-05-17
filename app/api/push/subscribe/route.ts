import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { upsertPushSubscription } from "@/models/push-subscription.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { isPushConfigured } from "@/utils/push-vapid.server"

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
})

export const POST = async (request: NextRequest) => {
  try {
    await requireCSRF(request)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status ?? 401 }
    )
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Web push is not configured on this server" },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 })
  }

  await upsertPushSubscription(authResult.user!.id, parsed.data)
  return NextResponse.json({ success: true })
}
