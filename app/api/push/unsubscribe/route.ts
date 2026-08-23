import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { deletePushSubscription } from "@/models/push-subscription.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
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

  const authResult = await authenticateUser(request, { requireParticipation: false })
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status ?? 401 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = UnsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  await deletePushSubscription(authResult.user!.id, parsed.data.endpoint)
  return NextResponse.json({ success: true })
}
