import { prisma } from "@/lib/db"
import {
  getNoteIdsForPerfume,
  getOrCreateScentProfile,
} from "@/models/scent-profile.server"
import type { RecommendationPerfume, RecommendationService } from "./types"

const PERFUME_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  perfumeHouse: {
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
    },
  },
} as const

type PerfumeRow = {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  perfumeHouse: {
    id: string
    name: string
    slug: string
    type: string
  } | null
}

function toRecommendationPerfume(p: PerfumeRow): RecommendationPerfume {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    image: p.image,
    perfumeHouse: p.perfumeHouse,
  }
}

/**
 * Get perfumes most similar to the given perfume by note overlap.
 * Uses PerfumeNoteRelation; orders by overlap count and returns top N.
 */
async function getSimilarPerfumes(
  perfumeId: string,
  limit: number
): Promise<RecommendationPerfume[]> {
  const noteIds = await getNoteIdsForPerfume(perfumeId)
  if (noteIds.length === 0) return []

  const relations = await prisma.perfumeNoteRelation.findMany({
    where: {
      noteId: { in: noteIds },
      perfumeId: { not: perfumeId },
    },
    select: { perfumeId: true },
  })

  const overlapCount: Record<string, number> = {}
  for (const r of relations) {
    overlapCount[r.perfumeId] = (overlapCount[r.perfumeId] ?? 0) + 1
  }

  const sortedIds = Object.entries(overlapCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id)

  if (sortedIds.length === 0) return []

  const perfumes = (await prisma.perfume.findMany({
    where: { id: { in: sortedIds } },
    select: PERFUME_SELECT,
  })) as PerfumeRow[]

  const byId = new Map(perfumes.map(p => [p.id, p]))
  return sortedIds
    .map(id => byId.get(id))
    .filter((p): p is PerfumeRow => p != null)
    .map(toRecommendationPerfume)
}

/**
 * Get personalized recommendations for a user from their ScentProfile.
 * Uses noteWeights and avoidNoteIds; fallback to popular perfumes if no profile data.
 */
async function getPersonalizedForUser(
  userId: string,
  limit: number
): Promise<RecommendationPerfume[]> {
  const profile = await getOrCreateScentProfile(userId)
  const weights = profile.noteWeights as Record<string, number>
  const avoidIds = (profile.avoidNoteIds as string[]) ?? []

  const preferredNoteIds = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .map(([id]) => id)

  if (preferredNoteIds.length === 0) {
    return getPopularPerfumesFallback(limit)
  }

  const relations = await prisma.perfumeNoteRelation.findMany({
    where: { noteId: { in: preferredNoteIds } },
    select: { perfumeId: true, noteId: true },
  })

  const scoreByPerfume: Record<string, number> = {}
  for (const r of relations) {
    const w = weights[r.noteId] ?? 0
    if (w > 0) scoreByPerfume[r.perfumeId] = (scoreByPerfume[r.perfumeId] ?? 0) + w
  }

  let candidateIds = Object.keys(scoreByPerfume)

  if (avoidIds.length > 0) {
    const withAvoid = await prisma.perfumeNoteRelation.findMany({
      where: { noteId: { in: avoidIds } },
      select: { perfumeId: true },
    })
    const avoidPerfumeIds = new Set(withAvoid.map(r => r.perfumeId))
    candidateIds = candidateIds.filter(id => !avoidPerfumeIds.has(id))
  }

  const sortedIds = candidateIds
    .sort((a, b) => (scoreByPerfume[b] ?? 0) - (scoreByPerfume[a] ?? 0))
    .slice(0, limit)

  if (sortedIds.length === 0) return getPopularPerfumesFallback(limit)

  const perfumes = (await prisma.perfume.findMany({
    where: { id: { in: sortedIds } },
    select: PERFUME_SELECT,
  })) as PerfumeRow[]

  const byId = new Map(perfumes.map(p => [p.id, p]))
  return sortedIds
    .map(id => byId.get(id))
    .filter((p): p is PerfumeRow => p != null)
    .map(toRecommendationPerfume)
}

/**
 * Fallback when user has no profile data: return perfumes by most ratings.
 */
async function getPopularPerfumesFallback(
  limit: number
): Promise<RecommendationPerfume[]> {
  const rated = await prisma.userPerfumeRating.groupBy({
    by: ["perfumeId"],
    _count: { perfumeId: true },
  })
  const perfumeIds = rated
    .sort((a, b) => (b._count.perfumeId ?? 0) - (a._count.perfumeId ?? 0))
    .slice(0, limit)
    .map(r => r.perfumeId)

  if (perfumeIds.length === 0) {
    const recent = (await prisma.perfume.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: PERFUME_SELECT,
    })) as PerfumeRow[]
    return recent.map(toRecommendationPerfume)
  }

  const perfumes = (await prisma.perfume.findMany({
    where: { id: { in: perfumeIds } },
    select: PERFUME_SELECT,
  })) as PerfumeRow[]
  const byId = new Map(perfumes.map(p => [p.id, p]))
  return perfumeIds
    .map(id => byId.get(id))
    .filter((p): p is PerfumeRow => p != null)
    .map(toRecommendationPerfume)
}

export const rulesRecommendationService: RecommendationService = {
  getSimilarPerfumes,
  getPersonalizedForUser,
}
