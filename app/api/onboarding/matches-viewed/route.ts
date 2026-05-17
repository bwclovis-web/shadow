import { NextRequest, NextResponse } from "next/server"

import { markOnboardingMatchesViewed } from "@/models/onboarding.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { CSRFError, requireCSRFForJsonBody } from "@/utils/server/csrf.server"

export const POST = async (request: NextRequest) => {
  try {
    const authResult = await authenticateUser(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status ?? 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    await requireCSRFForJsonBody(request, body)

    await markOnboardingMatchesViewed(authResult.user!.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("onboarding matches-viewed:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update onboarding" },
      { status: 500 }
    )
  }
}
