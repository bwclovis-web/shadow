import { prisma } from "@/lib/db"
import type { DataQualityStats } from "@/lib/queries/dataQuality"

import { computeDataQualityCore } from "./computeCoreMetrics"

/** UTC calendar date (noon avoids DST edge cases when converting to Date). */
export function utcCalendarDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0))
}

export async function loadHistoryData(limitDays = 90): Promise<DataQualityStats["historyData"]> {
  const rows = await prisma.dataQualityDailySnapshot.findMany({
    orderBy: { snapshotDate: "desc" },
    take: limitDays,
    select: {
      snapshotDate: true,
      totalMissing: true,
      totalDuplicates: true,
    },
  })

  if (rows.length === 0) return undefined

  const chronological = [...rows].reverse()

  return {
    dates: chronological.map(r => r.snapshotDate.toISOString().slice(0, 10)),
    missing: chronological.map(r => r.totalMissing),
    duplicates: chronological.map(r => r.totalDuplicates),
  }
}

/** Upsert today’s snapshot using all-time perfume scope (matches timeframe=all). */
export async function upsertTodayDataQualitySnapshot(): Promise<void> {
  const core = await computeDataQualityCore("all")
  const snapshotDate = utcCalendarDate(new Date())

  await prisma.dataQualityDailySnapshot.upsert({
    where: { snapshotDate },
    create: {
      snapshotDate,
      totalMissing: core.totalMissing,
      totalDuplicates: core.totalDuplicates,
      totalMissingHouseInfo: core.totalMissingHouseInfo ?? 0,
      totalHousesNoPerfumes: core.totalHousesNoPerfumes ?? 0,
    },
    update: {
      totalMissing: core.totalMissing,
      totalDuplicates: core.totalDuplicates,
      totalMissingHouseInfo: core.totalMissingHouseInfo ?? 0,
      totalHousesNoPerfumes: core.totalHousesNoPerfumes ?? 0,
    },
  })
}
