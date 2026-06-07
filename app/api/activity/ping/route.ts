import { NextRequest, NextResponse } from "next/server"

import { touchUserLastActive } from "@/models/user-activity.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"

export const POST = async (request: NextRequest) => {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error ?? "Unauthorized" },
        { status: authResult.status ?? 401 }
      )
    }

    await requireCSRF(request)

    await touchUserLastActive(authResult.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : "Activity ping failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
