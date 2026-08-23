import { NextRequest, NextResponse } from "next/server"

import { sendWeeklyDigests } from "@/models/digest-email.server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Sends Premium weekly digests via Resend.
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
    const result = await sendWeeklyDigests()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Weekly digest cron failed:", error)
    return NextResponse.json({ error: "Digest send failed" }, { status: 500 })
  }
}
