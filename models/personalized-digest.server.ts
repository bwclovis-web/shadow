import { prisma } from "@/lib/db"
import { getPersonalizedRecommendations } from "@/services/recommendations"
import { listSamplingQueue } from "@/models/sampling-queue.server"
import { listRecentSavedSearchMatchesForDigest } from "@/models/saved-search.server"
import { getUserAlertPreferences } from "@/models/user-alerts.server"
import { getStaleWishlistItemsForUser } from "@/models/wishlist-reengagement.server"
import { requireEntitlement } from "@/utils/membership/entitlements.server"

export type PersonalizedDigest = {
  userId: string
  weekOf: string
  recommendations: Array<{ id: string; name: string; slug: string; reason?: string }>
  samplingQueue: Array<{
    id: string
    perfumeName: string
    perfumeSlug: string
    houseName?: string | null
    status: string
  }>
  wardrobeHint: string
  collectionGaps: string[]
  savedSearchMatches: Array<{
    title: string
    message: string
    searchName: string
    createdAt: string
    targetUrl: string
  }>
  staleWishlist: Array<{
    perfumeName: string
    perfumeSlug: string
    addedAt: string
  }>
}

/**
 * Build a weekly personalized digest for Premium members (digital-only; no sales).
 */
export const buildPersonalizedDigest = async (
  userId: string
): Promise<PersonalizedDigest | null> => {
  const entitlement = await requireEntitlement(userId, "personalized_digests")
  if (!entitlement.ok) return null

  const [recs, queue, ownedCount, profile, ownedNotes, preferences, staleWishlistRaw] =
    await Promise.all([
    getPersonalizedRecommendations(userId, 5),
    listSamplingQueue(userId),
    prisma.userPerfume.count({ where: { userId } }),
    prisma.scentProfile.findUnique({
      where: { userId },
      select: { noteWeights: true },
    }),
    prisma.userPerfume.findMany({
      where: { userId },
      take: 100,
      select: {
        perfume: {
          select: {
            perfumeNoteRelations: {
              take: 8,
              select: { noteId: true, note: { select: { name: true } } },
            },
          },
        },
      },
    }),
    getUserAlertPreferences(userId),
    getStaleWishlistItemsForUser(userId),
  ])

  const since = new Date()
  since.setDate(since.getDate() - 1)
  const rawMatches =
    preferences.savedSearchAlertFrequency === "daily"
      ? await listRecentSavedSearchMatchesForDigest(userId, since)
      : []

  const buildTargetUrl = (payload: unknown) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return "/the-exchange"
    }
    const obj = payload as Record<string, unknown>
    if (typeof obj.perfumeSlug === "string") {
      return `/perfume/${obj.perfumeSlug}`
    }
    return "/the-exchange"
  }

  const savedSearchMatches = rawMatches.map(row => ({
    title: row.title,
    message: row.message,
    searchName: row.savedSearch.name,
    createdAt: row.createdAt.toISOString(),
    targetUrl: buildTargetUrl(row.payload),
  }))

  const month = new Date().getMonth()
  const season =
    month >= 2 && month <= 4
      ? "spring"
      : month >= 5 && month <= 7
        ? "summer"
        : month >= 8 && month <= 10
          ? "autumn"
          : "winter"

  const ownedNoteIds = new Set(
    ownedNotes.flatMap((row) =>
      row.perfume.perfumeNoteRelations.map((r) => r.noteId)
    )
  )
  const weights =
    profile?.noteWeights &&
    typeof profile.noteWeights === "object" &&
    !Array.isArray(profile.noteWeights)
      ? (profile.noteWeights as Record<string, number>)
      : {}
  const topLikedIds = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 8)
  const missingLikedIds = topLikedIds.filter((id) => !ownedNoteIds.has(id)).slice(0, 3)
  const missingNotes =
    missingLikedIds.length > 0
      ? await prisma.perfumeNotes.findMany({
          where: { id: { in: missingLikedIds } },
          select: { name: true },
        })
      : []

  const collectionGaps =
    ownedCount < 5
      ? ["Add a few more owned bottles to unlock richer gap analysis."]
      : missingNotes.length > 0
        ? missingNotes.map(
            (n) => `Gap vs taste profile: little of “${n.name}” in your collection.`
          )
        : ["Look for note families underrepresented in your collection."]

  return {
    userId,
    weekOf: new Date().toISOString().slice(0, 10),
    recommendations: recs.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      reason: r.reason?.kind,
    })),
    samplingQueue: queue.slice(0, 5).map(q => ({
      id: q.id,
      perfumeName: q.perfume.name,
      perfumeSlug: q.perfume.slug,
      houseName: q.perfume.perfumeHouse?.name ?? null,
      status: q.status,
    })),
    wardrobeHint: `Rotate toward ${season} wear — soft transitions and complementary notes.`,
    collectionGaps,
    savedSearchMatches,
    staleWishlist: staleWishlistRaw.map(item => ({
      perfumeName: item.perfumeName,
      perfumeSlug: item.perfumeSlug,
      addedAt: item.addedAt,
    })),
  }
}
