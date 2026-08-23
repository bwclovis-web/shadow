import { NextRequest, NextResponse } from "next/server"

import { exportCollectionCsv } from "@/models/collection-insights.server"
import { authenticateUser } from "@/utils/server/auth.server"

export const GET = async (request: NextRequest) => {
  const auth = await authenticateUser(request)
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })
  }
  const csv = await exportCollectionCsv(auth.user!.id)
  if (csv == null) {
    return NextResponse.json(
      { error: "Collection export is a Collector benefit." },
      { status: 403 }
    )
  }
  return NextResponse.json({ success: true, csv })
}
