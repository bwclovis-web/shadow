import { NextRequest, NextResponse } from "next/server"

import { upsertTodayDataQualitySnapshot } from "@/lib/data-quality/snapshotHistory"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Writes or updates today’s data quality snapshot (UTC date).
 * Requires CRON_SECRET: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 })
  }

  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (bearer !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await upsertTodayDataQualitySnapshot()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[cron/data-quality-snapshot]", error)
    return NextResponse.json({ error: "Snapshot failed" }, { status: 500 })
  }
}
