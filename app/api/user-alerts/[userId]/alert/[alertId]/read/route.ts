import { NextRequest, NextResponse } from "next/server"
import { markAlertAsRead } from "@/models/user-alerts.server"
import { ErrorHandler } from "@/utils/errorHandling"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string; alertId: string }> }
) {
  try {
    await requireCSRF(request)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
  const { userId, alertId } = await context.params
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status ?? 401 })
  }
  if (userId !== authResult.user!.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  try {
    const result = await markAlertAsRead(alertId, authResult.user!.id)
    if (result.count === 0) {
      return NextResponse.json({ error: "Alert not found or already read" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("does not exist in the current database")
    ) {
      return NextResponse.json({ success: true })
    }
    const appError = ErrorHandler.handle(error, {
      api: "user-alerts",
      action: "mark-read",
      alertId,
      userId: authResult.user!.id,
    })
    return NextResponse.json({ error: appError.userMessage }, { status: 500 })
  }
}
