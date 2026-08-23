import { prisma } from "@/lib/db"
import { getScentDnaForUser } from "@/models/scent-dna.server"
import { getSeasonalTrendingPerfumes } from "@/models/seasonal-trending.server"
import { getPersonalizedRecommendations } from "@/services/recommendations"
import { classifyNoteNameToFamily } from "@/utils/scent-dna/note-families"
import { requireEntitlement } from "@/utils/membership/entitlements.server"
import { getCurrentSeasonKey } from "@/utils/season-calendar"

export type SeasonalPlanningSuggestion = {
  id: string
  name: string
  slug: string
  image: string | null
  reason: "collection" | "recent_wear" | "trending" | "scent_dna" | "quiz_pref"
  /** Note-family rationale when DNA/quiz drove the pick (CF-061). */
  noteFamilyRationale?: string
}

/**
 * Premium seasonal planning: blend collection, recent wears, Scent DNA families,
 * quiz prefs, and seasonal trending. No LLM — deterministic from existing data.
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
  const [collection, recentWears, trending, dna, personalized] = await Promise.all([
    prisma.userPerfume.findMany({
      where: { userId },
      take: 12,
      orderBy: { updatedAt: "desc" },
      select: {
        perfume: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            perfumeNoteRelations: {
              take: 8,
              select: { note: { select: { name: true } } },
            },
          },
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
        oilPerfume: {
          select: { id: true, name: true, slug: true, image: true },
        },
      },
    }),
    getSeasonalTrendingPerfumes(6, season),
    getScentDnaForUser(userId),
    getPersonalizedRecommendations(userId, 6),
  ])

  const topFamilies = dna.topFamilies.slice(0, 3).map(f => f.family)
  const topFamilySet = new Set(topFamilies)

  const seen = new Set<string>()
  const suggestions: SeasonalPlanningSuggestion[] = []

  const push = (
    perfume: { id: string; name: string; slug: string; image: string | null },
    reason: SeasonalPlanningSuggestion["reason"],
    noteFamilyRationale?: string
  ) => {
    if (seen.has(perfume.id) || suggestions.length >= 12) return
    seen.add(perfume.id)
    suggestions.push({
      id: perfume.id,
      name: perfume.name,
      slug: perfume.slug,
      image: perfume.image,
      reason,
      noteFamilyRationale,
    })
  }

  for (const row of recentWears) {
    push(row.perfume, "recent_wear")
    if (row.oilPerfume) push(row.oilPerfume, "recent_wear")
  }

  for (const row of collection) {
    const noteNames = row.perfume.perfumeNoteRelations.map(r => r.note.name)
    const matchedFamily = noteNames
      .map(n => classifyNoteNameToFamily(n))
      .find(f => f && topFamilySet.has(f))
    if (matchedFamily) {
      push(
        row.perfume,
        "scent_dna",
        `Aligned with your ${matchedFamily} preference`
      )
    } else {
      push(row.perfume, "collection")
    }
  }

  for (const rec of personalized) {
    const matchedFamily =
      rec.reason?.kind === "profile_match"
        ? rec.reason.matchedNoteNames
            .map(n => classifyNoteNameToFamily(n))
            .find(f => f && topFamilySet.has(f))
        : rec.reason?.kind === "similar_notes"
          ? rec.reason.sharedNoteNames
              .map(n => classifyNoteNameToFamily(n))
              .find(f => f && topFamilySet.has(f))
          : undefined

    const isQuiz =
      rec.reason?.kind === "profile_match" ||
      rec.reason?.kind === "similar_notes"

    push(
      {
        id: rec.id,
        name: rec.name,
        slug: rec.slug,
        image: rec.image ?? null,
      },
      isQuiz ? "quiz_pref" : "scent_dna",
      matchedFamily
        ? `Note family: ${matchedFamily}`
        : topFamilies[0]
          ? `Matches your ${topFamilies[0]} Scent DNA`
          : "Matches your scent quiz preferences"
    )
  }

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
