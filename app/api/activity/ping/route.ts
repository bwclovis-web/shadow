import { NextRequest, NextResponse } from "next/server"

import { touchUserLastActive } from "@/models/user-activity.server"
import { authenticateUser } from "@/utils/server/auth.server"

export const POST = async (request: NextRequest) => {
  const authResult = await authenticateUser(request)
  if (!authResult.success || !authResult.user) {
    return NextResponse.json(
      { success: false, error: authResult.error ?? "Unauthorized" },
      { status: authResult.status ?? 401 }
    )
  }

  await touchUserLastActive(authResult.user.id)

  return NextResponse.json({ success: true })
}
