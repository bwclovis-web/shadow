import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"

const MESSAGE_RETENTION_DAYS = parseInt(
  process.env.MESSAGE_RETENTION_DAYS ?? "90",
  10
)

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Deletes trader contact messages older than MESSAGE_RETENTION_DAYS.
 * Secure with CRON_SECRET: call with Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null
    const querySecret = request.nextUrl.searchParams.get("secret")
    if (bearer !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - MESSAGE_RETENTION_DAYS)

  try {
    const result = await prisma.traderContactMessage.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    })
    return NextResponse.json({
      deleted: result.count,
      retentionDays: MESSAGE_RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
    })
  } catch (error) {
    console.error("Message cleanup failed:", error)
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    )
  }
}
