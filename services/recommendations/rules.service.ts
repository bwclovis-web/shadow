import { prisma } from "@/lib/db"
import {
  getNoteIdsForPerfume,
  getOrCreateScentProfile,
} from "@/models/scent-profile.server"
import type {
  RecommendationPerfume,
  RecommendationReason,
  RecommendationService,
} from "./types"

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
    select: { perfumeId: true, noteId: true },
  })

  const sharedByPerfume = new Map<string, Set<string>>()
  for (const r of relations) {
    let set = sharedByPerfume.get(r.perfumeId)
    if (!set) {
      set = new Set()
      sharedByPerfume.set(r.perfumeId, set)
    }
    set.add(r.noteId)
  }

  const overlapCount: Record<string, number> = {}
  for (const [pid, set] of sharedByPerfume) {
    overlapCount[pid] = set.size
  }

  const sortedIds = Object.entries(overlapCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => id)

  if (sortedIds.length === 0) return []

  const noteNameRows = await prisma.perfumeNotes.findMany({
    where: { id: { in: noteIds } },
    select: { id: true, name: true },
  })
  const idToName = new Map(noteNameRows.map(n => [n.id, n.name]))

  const perfumes = (await prisma.perfume.findMany({
    where: { id: { in: sortedIds } },
    select: PERFUME_SELECT,
  })) as PerfumeRow[]

  const byId = new Map(perfumes.map(p => [p.id, p]))
  return sortedIds
    .map((id): RecommendationPerfume | null => {
      const p = byId.get(id)
      if (!p) return null
      const sharedSet = sharedByPerfume.get(id)
      const sharedCount = sharedSet?.size ?? 0
      const sharedNoteNames = sharedSet
        ? [...sharedSet]
            .map(nid => idToName.get(nid))
            .filter((n): n is string => !!n)
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 4)
        : []
      const reason: RecommendationReason = {
        kind: "similar_notes",
        sharedNoteNames,
        sharedCount,
      }
      return { ...toRecommendationPerfume(p), reason }
    })
    .filter((p): p is RecommendationPerfume => p != null)
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
  const contribByPerfume: Record<string, Record<string, number>> = {}
  for (const r of relations) {
    const w = weights[r.noteId] ?? 0
    if (w <= 0) continue
    scoreByPerfume[r.perfumeId] = (scoreByPerfume[r.perfumeId] ?? 0) + w
    if (!contribByPerfume[r.perfumeId]) contribByPerfume[r.perfumeId] = {}
    contribByPerfume[r.perfumeId][r.noteId] =
      (contribByPerfume[r.perfumeId][r.noteId] ?? 0) + w
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

  const noteNameRows = await prisma.perfumeNotes.findMany({
    where: { id: { in: preferredNoteIds } },
    select: { id: true, name: true },
  })
  const idToName = new Map(noteNameRows.map(n => [n.id, n.name]))

  const perfumes = (await prisma.perfume.findMany({
    where: { id: { in: sortedIds } },
    select: PERFUME_SELECT,
  })) as PerfumeRow[]

  const byId = new Map(perfumes.map(p => [p.id, p]))
  return sortedIds
    .map((id): RecommendationPerfume | null => {
      const p = byId.get(id)
      if (!p) return null
      const contrib = contribByPerfume[id] ?? {}
      const topNoteIds = Object.entries(contrib)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
        .map(([noteId]) => noteId)
      const matchedNoteNames = topNoteIds
        .map(nid => idToName.get(nid))
        .filter((n): n is string => !!n)
      const reason: RecommendationReason = {
        kind: "profile_match",
        matchedNoteNames,
      }
      return { ...toRecommendationPerfume(p), reason }
    })
    .filter((p): p is RecommendationPerfume => p != null)
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
    return recent.map(
      (p): RecommendationPerfume => ({
        ...toRecommendationPerfume(p),
        reason: { kind: "recent" },
      })
    )
  }

  const perfumes = (await prisma.perfume.findMany({
    where: { id: { in: perfumeIds } },
    select: PERFUME_SELECT,
  })) as PerfumeRow[]
  const byId = new Map(perfumes.map(p => [p.id, p]))
  return perfumeIds
    .map((id): RecommendationPerfume | null => {
      const p = byId.get(id)
      if (!p) return null
      return {
        ...toRecommendationPerfume(p),
        reason: { kind: "popular" },
      }
    })
    .filter((p): p is RecommendationPerfume => p != null)
}

export const rulesRecommendationService: RecommendationService = {
  getSimilarPerfumes,
  getPersonalizedForUser,
}
