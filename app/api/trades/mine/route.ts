import { NextRequest, NextResponse } from "next/server"

import { getInitiatorOfferableListings } from "@/models/trade.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { createSuccessResponse } from "@/utils/response.server"

export const GET = async (request: NextRequest) => {
  const authResult = await authenticateUser(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status ?? 401 }
    )
  }

  const listings = await getInitiatorOfferableListings(authResult.user!.id)
  return createSuccessResponse({ listings })
}
