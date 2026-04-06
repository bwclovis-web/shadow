import { subDays } from "date-fns"

import { prisma } from "@/lib/db"
import type { DataQualityStats, DataQualityTimeframe } from "@/lib/queries/dataQuality"

import {
  getHouseMissingQualityFields,
  houseHasMissingQualityInfo,
  normalizeDuplicateKey,
  perfumeHasMissingInfo,
} from "./rules"

type Timeframe = DataQualityTimeframe

const buildDateFilter = (timeframe: Timeframe) => {
  if (timeframe === "all") return undefined
  const days = timeframe === "week" ? 7 : 30
  return { gte: subDays(new Date(), days) }
}

/** Core metrics for the dashboard (everything except lastUpdated and historyData). */
export async function computeDataQualityCore(
  timeframe: Timeframe
): Promise<Omit<DataQualityStats, "lastUpdated" | "historyData">> {
  const dateFilter = buildDateFilter(timeframe)

  const [allPerfumes, allHouses, housesWithNoPerfumes] = await Promise.all([
    prisma.perfume.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      select: {
        id: true,
        name: true,
        description: true,
        perfumeHouseId: true,
        perfumeHouse: { select: { name: true } },
      },
    }),
    prisma.perfumeHouse.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        description: true,
        website: true,
        email: true,
        createdAt: true,
        _count: { select: { perfumes: true } },
      },
    }),
    prisma.perfumeHouse.findMany({
      where: { perfumes: { none: {} } },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        createdAt: true,
      },
    }),
  ])

  const missingByBrand: Record<string, number> = {}
  let totalMissing = 0
  for (const p of allPerfumes) {
    if (perfumeHasMissingInfo(p)) {
      totalMissing += 1
      const brand = p.perfumeHouse?.name ?? "(No house)"
      missingByBrand[brand] = (missingByBrand[brand] ?? 0) + 1
    }
  }

  const duplicatesByBrand: Record<string, number> = {}
  const byHouseAndName = new Map<string, number>()
  for (const p of allPerfumes) {
    const houseName = p.perfumeHouse?.name ?? "(No house)"
    const key = `${normalizeDuplicateKey(houseName)}\0${normalizeDuplicateKey(p.name)}`
    byHouseAndName.set(key, (byHouseAndName.get(key) ?? 0) + 1)
  }
  for (const [key, count] of byHouseAndName) {
    if (count > 1) {
      const houseName = key.split("\0")[0]!
      duplicatesByBrand[houseName] = (duplicatesByBrand[houseName] ?? 0) + (count - 1)
    }
  }
  const totalDuplicates = Object.values(duplicatesByBrand).reduce((a, b) => a + b, 0)

  const housesWithMissingHouseInfo: NonNullable<
    DataQualityStats["housesWithMissingHouseInfo"]
  > = []
  const missingHouseInfoByBrand: Record<string, number> = {}
  let totalMissingHouseInfo = 0

  for (const h of allHouses) {
    if (houseHasMissingQualityInfo(h)) {
      const missingFields = getHouseMissingQualityFields(h)
      totalMissingHouseInfo += 1
      missingHouseInfoByBrand[h.name] = missingFields.length
      housesWithMissingHouseInfo.push({
        id: h.id,
        name: h.name,
        slug: h.slug,
        type: h.type,
        missingFields,
      })
    }
  }

  housesWithMissingHouseInfo.sort((a, b) => b.missingFields.length - a.missingFields.length)

  return {
    totalMissing,
    totalDuplicates,
    missingByBrand,
    duplicatesByBrand,
    totalMissingHouseInfo,
    missingHouseInfoByBrand,
    totalHousesNoPerfumes: housesWithNoPerfumes.length,
    housesNoPerfumes: housesWithNoPerfumes.map(h => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      type: h.type,
      createdAt: h.createdAt.toISOString(),
    })),
    housesWithMissingHouseInfo,
  }
}
