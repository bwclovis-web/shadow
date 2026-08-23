import { prisma } from "@/lib/db"
import { getScentDnaForUser } from "@/models/scent-dna.server"
import { classifyNoteNameToFamily } from "@/utils/scent-dna/note-families"
import { requireEntitlement } from "@/utils/membership/entitlements.server"
import { getCurrentSeasonKey } from "@/utils/season-calendar"

export type WearSuggestionReason =
  | "season_fit"
  | "profile_fit"
  | "recent_wear"
  | "collection"

export type WearSuggestion = {
  id: string
  name: string
  slug: string
  image: string | null
  reason: WearSuggestionReason
  rationale: string
}

/**
 * Premium "what should I wear?" — three picks from owned bottles with one-line rationale.
 * Gated by seasonal_planning (same Premium cluster as wear-this-season).
 */
export const getWearSuggestions = async (
  userId: string,
  options?: { occasion?: string; weather?: string }
): Promise<
  | { ok: true; season: string; suggestions: WearSuggestion[] }
  | { ok: false; reason: "entitlement" }
> => {
  const entitlement = await requireEntitlement(userId, "seasonal_planning")
  if (!entitlement.ok) {
    return { ok: false, reason: "entitlement" }
  }

  const season = getCurrentSeasonKey()
  const seasonField =
    season === "fall" ? "fall" : season === "spring" ? "spring" : season === "summer" ? "summer" : "winter"

  const [owned, recentWears, seasonVotes, dna] = await Promise.all([
    prisma.userPerfume.findMany({
      where: { userId },
      take: 40,
      orderBy: { updatedAt: "desc" },
      select: {
        perfumeId: true,
        perfume: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            perfumeNoteRelations: {
              take: 12,
              select: { note: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.wearJournalEntry.findMany({
      where: { userId },
      take: 20,
      orderBy: { wornOn: "desc" },
      select: { perfumeId: true, oilPerfumeId: true, wornOn: true },
    }),
    prisma.userPerfumeSeasonVote.findMany({
      where: { userId },
      select: {
        perfumeId: true,
        winter: true,
        spring: true,
        summer: true,
        fall: true,
      },
    }),
    getScentDnaForUser(userId),
  ])

  if (owned.length === 0) {
    return { ok: true, season, suggestions: [] }
  }

  const topFamilies = new Set(dna.topFamilies.slice(0, 3).map(f => f.family))
  const voteByPerfume = new Map(seasonVotes.map(v => [v.perfumeId, v]))
  const recentlyWorn = new Set(
    recentWears.slice(0, 5).flatMap(w =>
      [w.perfumeId, w.oilPerfumeId].filter((id): id is string => Boolean(id))
    )
  )
  const wornInLast7 = new Set(
    recentWears
      .filter(w => Date.now() - w.wornOn.getTime() < 7 * 24 * 60 * 60 * 1000)
      .flatMap(w =>
        [w.perfumeId, w.oilPerfumeId].filter((id): id is string => Boolean(id))
      )
  )

  type Scored = {
    perfume: (typeof owned)[number]["perfume"]
    score: number
    reason: WearSuggestionReason
    rationale: string
  }

  const scored: Scored[] = owned.map(row => {
    const perfume = row.perfume
    const vote = voteByPerfume.get(perfume.id)
    const seasonScore = vote ? Number(vote[seasonField] ?? 0) : 0
    const noteNames = perfume.perfumeNoteRelations.map(r => r.note.name)
    const families = noteNames
      .map(n => classifyNoteNameToFamily(n))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
    const familyOverlap = families.filter(f => topFamilies.has(f)).length
    const recently = recentlyWorn.has(perfume.id)
    const wornThisWeek = wornInLast7.has(perfume.id)

    let score = 1
    let reason: WearSuggestionReason = "collection"
    let rationale = "From your collection"

    if (seasonScore >= 1) {
      score += 4 + seasonScore
      reason = "season_fit"
      rationale = `Fits your ${season} votes`
    }
    if (familyOverlap > 0) {
      score += 3 * familyOverlap
      if (reason !== "season_fit") {
        reason = "profile_fit"
        rationale = `Matches your Scent DNA (${families.find(f => topFamilies.has(f))})`
      } else {
        rationale = `Fits ${season} and your Scent DNA`
      }
    }
    if (recently && !wornThisWeek) {
      score += 2
      if (reason === "collection") {
        reason = "recent_wear"
        rationale = "Recently worn — good rotation candidate"
      }
    }
    if (wornThisWeek) {
      score -= 3
    }
    if (options?.occasion) {
      score += 0.5
    }
    if (options?.weather) {
      score += 0.5
    }

    return { perfume, score, reason, rationale }
  })

  scored.sort((a, b) => b.score - a.score)

  const suggestions: WearSuggestion[] = scored.slice(0, 3).map(s => ({
    id: s.perfume.id,
    name: s.perfume.name,
    slug: s.perfume.slug,
    image: s.perfume.image,
    reason: s.reason,
    rationale: s.rationale,
  }))

  return { ok: true, season, suggestions }
}
