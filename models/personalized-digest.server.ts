import { prisma } from "@/lib/db"
import { getPersonalizedRecommendations } from "@/services/recommendations"
import { listSamplingQueue } from "@/models/sampling-queue.server"
import { requireEntitlement } from "@/utils/membership/entitlements.server"

export type PersonalizedDigest = {
  userId: string
  weekOf: string
  recommendations: Array<{ id: string; name: string; slug: string; reason?: string }>
  samplingQueue: Array<{ perfumeName: string; status: string }>
  wardrobeHint: string
  collectionGaps: string[]
}

/**
 * Build a weekly personalized digest for Premium members (digital-only; no sales).
 */
export const buildPersonalizedDigest = async (
  userId: string
): Promise<PersonalizedDigest | null> => {
  const entitlement = await requireEntitlement(userId, "personalized_digests")
  if (!entitlement.ok) return null

  const [recs, queue, ownedCount, profile, ownedNotes] = await Promise.all([
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
  ])

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
      perfumeName: q.perfume.name,
      status: q.status,
    })),
    wardrobeHint: `Rotate toward ${season} wear — soft transitions and complementary notes.`,
    collectionGaps,
  }
}
