import { NextRequest, NextResponse } from "next/server"

import { computeDataQualityCore } from "@/lib/data-quality/computeCoreMetrics"
import { loadHistoryData } from "@/lib/data-quality/snapshotHistory"
import type { DataQualityStats } from "@/lib/queries/dataQuality"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

type Timeframe = "week" | "month" | "all"

export const GET = async (request: NextRequest) => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  try {
    const timeframe = (request.nextUrl.searchParams.get("timeframe") ||
      "month") as Timeframe
    if (!["week", "month", "all"].includes(timeframe)) {
      return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 })
    }

    const [core, historyData] = await Promise.all([
      computeDataQualityCore(timeframe),
      loadHistoryData(90),
    ])

    const stats: DataQualityStats = {
      ...core,
      historyData,
      lastUpdated: new Date().toISOString(),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("[api/data-quality]", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load data quality stats",
      },
      { status: 500 }
    )
  }
}
