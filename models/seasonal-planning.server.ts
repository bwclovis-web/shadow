import { prisma } from "@/lib/db"
import { getSeasonalTrendingPerfumes } from "@/models/seasonal-trending.server"
import { requireEntitlement } from "@/utils/membership/entitlements.server"
import { getCurrentSeasonKey } from "@/utils/season-calendar"

export type SeasonalPlanningSuggestion = {
  id: string
  name: string
  slug: string
  image: string | null
  reason: "collection" | "recent_wear" | "trending"
}

/**
 * Premium seasonal planning: blend collection, recent wears, and seasonal trending.
 * No LLM — deterministic from existing data.
 */
export const getSeasonalPlanningSuggestions = async (
  userId: string
): Promise<{
  ok: true
  season: string
  suggestions: SeasonalPlanningSuggestion[]
} | { ok: false; reason: "entitlement" }> => {
  const entitlement = await requireEntitlement(userId, "seasonal_planning")
  if (!entitlement.ok) {
    return { ok: false, reason: "entitlement" }
  }

  const season = getCurrentSeasonKey()
  const [collection, recentWears, trending] = await Promise.all([
    prisma.userPerfume.findMany({
      where: { userId },
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        perfume: {
          select: { id: true, name: true, slug: true, image: true },
        },
      },
    }),
    prisma.wearJournalEntry.findMany({
      where: { userId },
      take: 5,
      orderBy: { wornOn: "desc" },
      select: {
        perfume: {
          select: { id: true, name: true, slug: true, image: true },
        },
      },
    }),
    getSeasonalTrendingPerfumes(6, season),
  ])

  const seen = new Set<string>()
  const suggestions: SeasonalPlanningSuggestion[] = []

  const push = (
    perfume: { id: string; name: string; slug: string; image: string | null },
    reason: SeasonalPlanningSuggestion["reason"]
  ) => {
    if (seen.has(perfume.id) || suggestions.length >= 12) return
    seen.add(perfume.id)
    suggestions.push({
      id: perfume.id,
      name: perfume.name,
      slug: perfume.slug,
      image: perfume.image,
      reason,
    })
  }

  for (const row of recentWears) push(row.perfume, "recent_wear")
  for (const row of collection) push(row.perfume, "collection")
  for (const row of trending.perfumes) {
    push(
      {
        id: row.perfumeId,
        name: row.name,
        slug: row.slug,
        image: row.image,
      },
      "trending"
    )
  }

  return { ok: true, season, suggestions }
}
