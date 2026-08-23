import { NextRequest, NextResponse } from "next/server"

import { runSavedSearchMatchPass } from "@/models/saved-search-matcher.server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Matches Premium saved searches to new Exchange listings / catalog items.
 * Authorization: Bearer CRON_SECRET
 */
export const GET = async (request: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null
  if (bearer !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runSavedSearchMatchPass()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Saved search match cron failed:", error)
    return NextResponse.json({ error: "Match pass failed" }, { status: 500 })
  }
}
