import { NextRequest, NextResponse } from "next/server"
import { subDays } from "date-fns"

import { prisma } from "@/lib/db"
import type { DataQualityStats } from "@/lib/queries/dataQuality"
import { requireAdminOrEditorApi } from "@/utils/server/requireAdminOrEditorApi.server"

type Timeframe = "week" | "month" | "all"

const buildDateFilter = (timeframe: Timeframe) => {
  if (timeframe === "all") return undefined
  const days = timeframe === "week" ? 7 : 30
  return { gte: subDays(new Date(), days) }
}

export const GET = async (request: NextRequest) => {
  const auth = await requireAdminOrEditorApi(request)
  if (!auth.allowed) return auth.response

  try {
    const timeframe = (request.nextUrl.searchParams.get("timeframe") ||
      "month") as Timeframe
    if (!["week", "month", "all"].includes(timeframe)) {
      return NextResponse.json(
        { error: "Invalid timeframe" },
        { status: 400 }
      )
    }

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
          type: true,
          createdAt: true,
        },
      }),
    ])

    const missingByBrand: Record<string, number> = {}
    let totalMissing = 0
    for (const p of allPerfumes) {
      const hasNoDescription = !p.description?.trim()
      const hasNoHouse = !p.perfumeHouseId
      if (hasNoDescription || hasNoHouse) {
        totalMissing += 1
        const brand = p.perfumeHouse?.name ?? "(No house)"
        missingByBrand[brand] = (missingByBrand[brand] ?? 0) + 1
      }
    }

    const duplicatesByBrand: Record<string, number> = {}
    const byHouseAndName = new Map<string, number>()
    for (const p of allPerfumes) {
      const houseName = p.perfumeHouse?.name ?? "(No house)"
      const key = `${houseName}\0${p.name}`
      byHouseAndName.set(key, (byHouseAndName.get(key) ?? 0) + 1)
    }
    for (const [key, count] of byHouseAndName) {
      if (count > 1) {
        const houseName = key.split("\0")[0]!
        duplicatesByBrand[houseName] =
          (duplicatesByBrand[houseName] ?? 0) + (count - 1)
      }
    }
    const totalDuplicates = Object.values(duplicatesByBrand).reduce(
      (a, b) => a + b,
      0
    )

    const missingHouseInfoByBrand: Record<string, number> = {}
    let totalMissingHouseInfo = 0
    for (const h of allHouses) {
      const missing =
        !h.description?.trim() || !h.website?.trim() || !h.email?.trim()
      if (missing) {
        totalMissingHouseInfo += 1
        missingHouseInfoByBrand[h.name] = 1
      }
    }

    const stats: DataQualityStats = {
      totalMissing,
      totalDuplicates,
      missingByBrand,
      duplicatesByBrand,
      lastUpdated: new Date().toISOString(),
      totalMissingHouseInfo,
      missingHouseInfoByBrand,
      totalHousesNoPerfumes: housesWithNoPerfumes.length,
      housesNoPerfumes: housesWithNoPerfumes.map((h) => ({
        id: h.id,
        name: h.name,
        type: h.type,
        createdAt: h.createdAt.toISOString(),
      })),
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("[api/data-quality]", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load data quality stats",
      },
      { status: 500 }
    )
  }
}
