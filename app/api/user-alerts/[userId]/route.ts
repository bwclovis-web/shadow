import { NextRequest, NextResponse } from "next/server"
import {
  getUnreadAlertCount,
  getUnreadTradeAlertCount,
  getUserAlerts,
} from "@/models/user-alerts.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status ?? 401 })
  }
  if (userId !== authResult.user!.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  try {
    const [alerts, unreadCount, tradeUnreadCount] = await Promise.all([
      getUserAlerts(userId),
      getUnreadAlertCount(userId),
      getUnreadTradeAlertCount(userId),
    ])
    return NextResponse.json({
      alerts: alerts ?? [],
      unreadCount: unreadCount ?? 0,
      tradeUnreadCount: tradeUnreadCount ?? 0,
    })
  } catch (error) {
    console.warn("UserAlert tables not available:", error)
    return NextResponse.json({ alerts: [], unreadCount: 0, tradeUnreadCount: 0 })
  }
}
