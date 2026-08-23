import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { updateConversationPresence } from "@/models/conversation-presence.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"

const PresenceSchema = z.object({
  counterpartUserId: z.string().cuid().nullable(),
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
  const parsed = PresenceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  await updateConversationPresence(
    authResult.user!.id,
    parsed.data.counterpartUserId
  )

  return NextResponse.json({ success: true })
}
