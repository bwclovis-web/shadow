import { prisma } from "@/lib/db"
import { isCollectionBottle } from "@/lib/user-inventory"
import {
  getAdvancedCollectionIntelligence,
  type AdvancedCollectionIntelligence,
} from "@/models/advanced-collection-intelligence.server"
import {
  getDeclaredVsActualDna,
  type DeclaredVsActualDna,
} from "@/models/declared-vs-actual-dna.server"
import { getUserInventoryStats } from "@/models/user-inventory-stats.server"
import { requireEntitlement } from "@/utils/membership/entitlements.server"

export type NeglectedBottle = {
  userPerfumeId: string
  perfumeId: string
  name: string
  slug: string
  image: string | null
  ownedDays: number
}

export type SeasonCoverage = {
  season: string
  wearCount: number
}

export type CollectionInsights = {
  bottleCount: number
  houseCount: number
  topFamilies: { name: string; share: number }[]
  tradedValue: number
  recentWearCount: number
  /** Premium */
  rotationScore: number | null
  neglectedBottles: NeglectedBottle[] | null
  seasonCoverage: SeasonCoverage[] | null
  advanced: AdvancedCollectionIntelligence | null
  declaredVsActual: DeclaredVsActualDna | null
  /** Collector */
  canExport: boolean
}

const MS_PER_DAY = 86_400_000
const NEGLECT_DAYS = 90

export const getCollectionInsights = async (
  userId: string
): Promise<CollectionInsights> => {
  const [stats, analyticsGate, exportGate, recentWears, bottles, wearBySeason] =
    await Promise.all([
      getUserInventoryStats(userId),
      requireEntitlement(userId, "collection_analytics"),
      requireEntitlement(userId, "export_history"),
      prisma.wearJournalEntry.count({
        where: {
          userId,
          wornOn: { gte: new Date(Date.now() - 30 * MS_PER_DAY) },
        },
      }),
      prisma.userPerfume.findMany({
        where: { userId },
        select: {
          id: true,
          perfumeId: true,
          amount: true,
          available: true,
          createdAt: true,
          perfume: {
            select: { id: true, name: true, slug: true, image: true },
          },
        },
      }),
      prisma.wearJournalEntry.groupBy({
        by: ["season"],
        where: { userId, season: { not: null } },
        _count: { _all: true },
      }),
    ])

  const [advanced, declaredVsActual] = analyticsGate.ok
    ? await Promise.all([
        getAdvancedCollectionIntelligence(userId),
        getDeclaredVsActualDna(userId),
      ])
    : [null, null]

  const collection = bottles.filter(isCollectionBottle)
  const wornPerfumeIds = new Set(
    (
      await prisma.wearJournalEntry.findMany({
        where: { userId },
        select: { perfumeId: true, oilPerfumeId: true },
      })
    ).flatMap(r =>
      [r.perfumeId, r.oilPerfumeId].filter((id): id is string => Boolean(id))
    )
  )

  const now = Date.now()
  let neglectedBottles: NeglectedBottle[] | null = null
  let rotationScore: number | null = null
  let seasonCoverage: SeasonCoverage[] | null = null

  if (analyticsGate.ok) {
    neglectedBottles = collection
      .filter(b => {
        const ownedDays = Math.floor((now - b.createdAt.getTime()) / MS_PER_DAY)
        return ownedDays >= NEGLECT_DAYS && !wornPerfumeIds.has(b.perfumeId)
      })
      .map(b => ({
        userPerfumeId: b.id,
        perfumeId: b.perfumeId,
        name: b.perfume.name,
        slug: b.perfume.slug,
        image: b.perfume.image,
        ownedDays: Math.floor((now - b.createdAt.getTime()) / MS_PER_DAY),
      }))
      .sort((a, b) => b.ownedDays - a.ownedDays)
      .slice(0, 12)

    const uniqueOwned = new Set(collection.map(b => b.perfumeId)).size
    const uniqueWorn = wornPerfumeIds.size
    rotationScore =
      uniqueOwned === 0
        ? 0
        : Math.round(Math.min(100, (uniqueWorn / uniqueOwned) * 100))

    const seasons = ["winter", "spring", "summer", "fall"]
    const bySeason = new Map(
      wearBySeason
        .filter(r => r.season)
        .map(r => [r.season!.toLowerCase(), r._count._all])
    )
    seasonCoverage = seasons.map(season => ({
      season,
      wearCount: bySeason.get(season) ?? 0,
    }))
  }

  return {
    bottleCount: stats.bottleCount,
    houseCount: stats.houseCount,
    topFamilies: stats.topFamilies.map(f => ({
      name: f.family,
      share: f.percent,
    })),
    tradedValue: stats.tradedValue,
    recentWearCount: recentWears,
    rotationScore,
    neglectedBottles,
    seasonCoverage,
    advanced,
    declaredVsActual,
    canExport: exportGate.ok,
  }
}

export const exportCollectionCsv = async (userId: string): Promise<string | null> => {
  const gate = await requireEntitlement(userId, "export_history")
  if (!gate.ok) return null

  const [bottles, wears] = await Promise.all([
    prisma.userPerfume.findMany({
      where: { userId },
      select: {
        amount: true,
        available: true,
        price: true,
        createdAt: true,
        perfume: {
          select: {
            name: true,
            slug: true,
            perfumeHouse: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wearJournalEntry.findMany({
      where: { userId },
      select: {
        wornOn: true,
        season: true,
        weather: true,
        occasion: true,
        rating: true,
        notes: true,
        perfume: { select: { name: true, slug: true } },
        oilPerfume: { select: { name: true, slug: true } },
      },
      orderBy: { wornOn: "desc" },
      take: 5000,
    }),
  ])

  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const collectionLines = [
    "type,perfume,house,slug,amount,available,price,addedAt",
    ...bottles.map(
      b =>
        [
          "collection",
          esc(b.perfume.name),
          esc(b.perfume.perfumeHouse?.name),
          esc(b.perfume.slug),
          esc(b.amount),
          esc(b.available),
          esc(b.price),
          esc(b.createdAt.toISOString()),
        ].join(",")
    ),
  ]

  const wearLines = [
    "type,perfume,slug,oilPerfume,oilSlug,wornOn,season,weather,occasion,rating,notes",
    ...wears.map(
      w =>
        [
          "wear",
          esc(w.perfume.name),
          esc(w.perfume.slug),
          esc(w.oilPerfume?.name),
          esc(w.oilPerfume?.slug),
          esc(w.wornOn.toISOString().slice(0, 10)),
          esc(w.season),
          esc(w.weather),
          esc(w.occasion),
          esc(w.rating),
          esc(w.notes),
        ].join(",")
    ),
  ]

  return [...collectionLines, "", ...wearLines].join("\n")
}
