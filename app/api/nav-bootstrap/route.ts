import { NextRequest, NextResponse } from "next/server"

import { getNavBadgeBootstrap } from "@/models/nav-bootstrap.server"
import { authenticateUser } from "@/utils/server/auth.server"

/**
 * Nav badge bootstrap for logged-in chrome (alerts + DM unread).
 * Auth only — no participation gate (badges are read for any signed-in user).
 */
export const GET = async (request: NextRequest) => {
  const authResult = await authenticateUser(request, {
    requireParticipation: false,
  })
  if (!authResult.success || !authResult.user) {
    return NextResponse.json(
      { error: authResult.error ?? "Unauthorized" },
      { status: authResult.status ?? 401 }
    )
  }

  try {
    const data = await getNavBadgeBootstrap(authResult.user.id)
    return NextResponse.json(data)
  } catch (error) {
    console.warn("Nav bootstrap failed:", error)
    return NextResponse.json({
      alerts: [],
      unreadCount: 0,
      tradeUnreadCount: 0,
      directMessageUnreadCount: 0,
    })
  }
}
