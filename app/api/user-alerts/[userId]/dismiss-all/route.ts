import { NextRequest, NextResponse } from "next/server"
import { dismissAllAlerts } from "@/models/user-alerts.server"
import { ErrorHandler } from "@/utils/errorHandling"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireCSRF(request)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }
  const { userId } = await context.params
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status ?? 401 })
  }
  if (userId !== authResult.user!.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  try {
    await dismissAllAlerts(userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      return NextResponse.json({ success: true })
    }
    const appError = ErrorHandler.handle(error, { api: "user-alerts", action: "dismiss-all", userId })
    return NextResponse.json({ error: appError.userMessage }, { status: 500 })
  }
}
