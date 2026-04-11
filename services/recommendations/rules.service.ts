import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { fetchPerfumeIdsWithListingPriceInRange } from "@/models/perfume.server"
import { getUserCollectionOrDestashPerfumeIds } from "@/models/user.server"
import {
  getNoteIdsForPerfume,
  getOrCreateScentProfile,
} from "@/models/scent-profile.server"
import {
  buildIdfMap,
  cosineSimilarityFromIdf,
  COSINE_TIE_EPSILON,
  isPreferredPriceRangeUsable,
  parsePreferredPriceRange,
  parseSeasonHint,
  type SeasonVoteKey,
} from "./note-similarity"
import type {
  RecommendationPerfume,
  RecommendationReason,
  RecommendationService,
  GetSimilarPerfumesOptions,
} from "./types"

/** Weight for season vote signal relative to note score (personalized). */
const W_SEASON = 3
/** Weight for listing-in-price-range signal (personalized). */
const W_PRICE = 2
const WIDENED_POOL_FACTOR = 4
const WIDENED_POOL_MIN = 48
/** Max perfumes from the same house in profile recommendations. */
const PROFILE_MAX_PER_HOUSE = 2
/** Max perfumes from the same house in similar-perfume carousel. */
const SIMILAR_MAX_PER_HOUSE = 2

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

async function fetchDistinctPerfumeCountByNoteIds(
  noteIds: string[]
): Promise<Map<string, number>> {
  if (noteIds.length === 0) return new Map()
  const rows = await prisma.$queryRaw<{ noteId: string; df: number }[]>`
    SELECT "noteId", COUNT(DISTINCT "perfumeId")::int AS df
    FROM "PerfumeNoteRelation"
    WHERE "noteId" IN (${Prisma.join(noteIds)})
    GROUP BY "noteId"
  `
  return new Map(rows.map(r => [r.noteId, r.df]))
}

type SimilarRankRow = {
  id: string
  name: string
  houseId: string | null
  cosine: number
  sharedCount: number
}

type HouseCapRow = { id: string; houseId: string | null }

function pickWithHouseCap<T extends HouseCapRow>(
  sorted: T[],
  limit: number,
  maxPerHouse: number
): T[] {
  const picked: T[] = []
  const countByHouse = new Map<string, number>()

  const houseKey = (row: HouseCapRow) => row.houseId ?? "__no_house"

  for (const row of sorted) {
    if (picked.length >= limit) break
    const key = houseKey(row)
    const c = countByHouse.get(key) ?? 0
    if (c >= maxPerHouse) continue
    picked.push(row)
    countByHouse.set(key, c + 1)
  }

  if (picked.length < limit) {
    for (const row of sorted) {
      if (picked.length >= limit) break
      if (picked.some(p => p.id === row.id)) continue
      picked.push(row)
    }
  }

  return picked
}

function compareSimilarRows(a: SimilarRankRow, b: SimilarRankRow): number {
  if (Math.abs(b.cosine - a.cosine) > COSINE_TIE_EPSILON) {
    return b.cosine - a.cosine
  }
  if (b.sharedCount !== a.sharedCount) return b.sharedCount - a.sharedCount
  return a.name.localeCompare(b.name)
}

/**
 * Get perfumes most similar by IDF-weighted cosine note similarity.
 */
async function getSimilarPerfumes(
  perfumeId: string,
  limit: number,
  options?: GetSimilarPerfumesOptions
): Promise<RecommendationPerfume[]> {
  const noteIdsArr = await getNoteIdsForPerfume(perfumeId)
  if (noteIdsArr.length === 0) return []
  const sourceNoteIds = new Set(noteIdsArr)

  const relations = await prisma.perfumeNoteRelation.findMany({
    where: {
      noteId: { in: noteIdsArr },
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

  const candidateIds = [...sharedByPerfume.keys()]
  if (candidateIds.length === 0) return []

  const candidateNoteRows = await prisma.perfumeNoteRelation.findMany({
    where: { perfumeId: { in: candidateIds } },
    select: { perfumeId: true, noteId: true },
  })
  const notesByCandidate = new Map<string, Set<string>>()
  for (const r of candidateNoteRows) {
    let set = notesByCandidate.get(r.perfumeId)
    if (!set) {
      set = new Set()
      notesByCandidate.set(r.perfumeId, set)
    }
    set.add(r.noteId)
  }

  const unionNoteIds = new Set<string>(sourceNoteIds)
  for (const set of notesByCandidate.values()) {
    for (const id of set) unionNoteIds.add(id)
  }

  const noteIdList = [...unionNoteIds]
  const [totalPerfumeCount, dfMap] = await Promise.all([
    prisma.perfume.count(),
    fetchDistinctPerfumeCountByNoteIds(noteIdList),
  ])

  const idfByNote = buildIdfMap(noteIdList, dfMap, totalPerfumeCount)

  const metaRows = await prisma.perfume.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, name: true, perfumeHouseId: true },
  })
  const metaById = new Map(metaRows.map(m => [m.id, m]))

  const ranked: SimilarRankRow[] = []
  for (const cid of candidateIds) {
    const meta = metaById.get(cid)
    if (!meta) continue
    const candidateNotes = notesByCandidate.get(cid) ?? new Set()
    const shared = sharedByPerfume.get(cid)
    const cosine = cosineSimilarityFromIdf(
      sourceNoteIds,
      candidateNotes,
      idfByNote
    )
    ranked.push({
      id: cid,
      name: meta.name,
      houseId: meta.perfumeHouseId ?? null,
      cosine,
      sharedCount: shared?.size ?? 0,
    })
  }

  ranked.sort(compareSimilarRows)

  const excludeSimilar =
    options?.userId != null && options.userId !== ""
      ? await getUserCollectionOrDestashPerfumeIds(options.userId)
      : new Set<string>()
  const rankedForPick =
    excludeSimilar.size > 0
      ? ranked.filter((r) => !excludeSimilar.has(r.id))
      : ranked

  const picked = pickWithHouseCap(rankedForPick, limit, SIMILAR_MAX_PER_HOUSE)
  const sortedIds = picked.map(p => p.id)

  const noteNameRows = await prisma.perfumeNotes.findMany({
    where: { id: { in: noteIdsArr } },
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

type ProfileRankRow = {
  id: string
  name: string
  houseId: string | null
  finalScore: number
  avgOverall: number
}

function compareProfileRows(a: ProfileRankRow, b: ProfileRankRow): number {
  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
  if (b.avgOverall !== a.avgOverall) return b.avgOverall - a.avgOverall
  return a.name.localeCompare(b.name)
}

type SeasonVotePick = {
  perfumeId: string
  winter: boolean
  spring: boolean
  summer: boolean
  fall: boolean
}

/**
 * Get personalized recommendations from ScentProfile note weights,
 * with soft boosts from season votes and marketplace listing price range.
 */
async function getPersonalizedForUser(
  userId: string,
  limit: number
): Promise<RecommendationPerfume[]> {
  const excludeOwned = await getUserCollectionOrDestashPerfumeIds(userId)

  const profile = await getOrCreateScentProfile(userId)
  const weights = profile.noteWeights as Record<string, number>
  const avoidIds = (profile.avoidNoteIds as string[]) ?? []

  const preferredNoteIds = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .map(([id]) => id)

  if (preferredNoteIds.length === 0) {
    return getPopularPerfumesFallback(limit, excludeOwned)
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

  candidateIds = candidateIds.filter((id) => !excludeOwned.has(id))

  if (candidateIds.length === 0) return getPopularPerfumesFallback(limit, excludeOwned)

  const widenTake = Math.max(limit * WIDENED_POOL_FACTOR, WIDENED_POOL_MIN)
  const widenedIds = [...candidateIds]
    .sort((a, b) => (scoreByPerfume[b] ?? 0) - (scoreByPerfume[a] ?? 0))
    .slice(0, widenTake)

  const seasonPrefs = parseSeasonHint(profile.seasonHint)
  const priceRange = parsePreferredPriceRange(profile.preferredPriceRange)

  const votesPromise: Promise<SeasonVotePick[]> =
    seasonPrefs.size > 0
      ? prisma.userPerfumeSeasonVote.findMany({
          where: { perfumeId: { in: widenedIds } },
          select: {
            perfumeId: true,
            winter: true,
            spring: true,
            summer: true,
            fall: true,
          },
        })
      : Promise.resolve([])

  const priceIdsPromise =
    isPreferredPriceRangeUsable(priceRange) && priceRange
      ? fetchPerfumeIdsWithListingPriceInRange(priceRange.min, priceRange.max)
      : Promise.resolve([] as string[])

  const metaPromise = prisma.perfume.findMany({
    where: { id: { in: widenedIds } },
    select: { id: true, name: true, perfumeHouseId: true },
  })

  const ratingPromise = prisma.userPerfumeRating.groupBy({
    by: ["perfumeId"],
    where: { perfumeId: { in: widenedIds } },
    _avg: { overall: true },
  })

  const [votes, priceIdList, metaRows, ratingGroups] = await Promise.all([
    votesPromise,
    priceIdsPromise,
    metaPromise,
    ratingPromise,
  ])

  const priceInRange = new Set(priceIdList)

  const votesByPerfume = new Map<string, SeasonVotePick[]>()
  for (const v of votes) {
    const list = votesByPerfume.get(v.perfumeId) ?? []
    list.push(v)
    votesByPerfume.set(v.perfumeId, list)
  }

  const avgByPerfume = new Map(
    ratingGroups.map(g => [g.perfumeId, g._avg.overall ?? 0])
  )

  const metaById = new Map(metaRows.map(m => [m.id, m]))

  const seasonBoostFor = (perfumeId: string): number => {
    if (seasonPrefs.size === 0) return 0
    const rows = votesByPerfume.get(perfumeId) ?? []
    if (rows.length === 0) return 0
    let match = 0
    for (const row of rows) {
      for (const s of seasonPrefs) {
        if (row[s as SeasonVoteKey]) match++
      }
    }
    return match / rows.length
  }

  const priceBoostFor = (perfumeId: string): number => {
    if (!isPreferredPriceRangeUsable(priceRange) || priceInRange.size === 0) {
      return 0
    }
    return priceInRange.has(perfumeId) ? 1 : 0
  }

  const ranked: ProfileRankRow[] = []
  for (const id of widenedIds) {
    const meta = metaById.get(id)
    if (!meta) continue
    const noteScore = scoreByPerfume[id] ?? 0
    const sBoost = seasonBoostFor(id)
    const pBoost = priceBoostFor(id)
    const finalScore = noteScore + W_SEASON * sBoost + W_PRICE * pBoost
    ranked.push({
      id,
      name: meta.name,
      houseId: meta.perfumeHouseId ?? null,
      finalScore,
      avgOverall: avgByPerfume.get(id) ?? 0,
    })
  }

  ranked.sort(compareProfileRows)
  const picked = pickWithHouseCap(ranked, limit, PROFILE_MAX_PER_HOUSE)
  const sortedIds = picked.map(p => p.id)

  if (sortedIds.length === 0)
    return getPopularPerfumesFallback(limit, excludeOwned)

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
  limit: number,
  excludeIds: ReadonlySet<string> = new Set()
): Promise<RecommendationPerfume[]> {
  const rated = await prisma.userPerfumeRating.groupBy({
    by: ["perfumeId"],
    _count: { perfumeId: true },
  })
  const sortedRated = [...rated].sort(
    (a, b) => (b._count.perfumeId ?? 0) - (a._count.perfumeId ?? 0)
  )
  const perfumeIds: string[] = []
  for (const r of sortedRated) {
    if (perfumeIds.length >= limit) break
    if (excludeIds.has(r.perfumeId)) continue
    perfumeIds.push(r.perfumeId)
  }

  if (perfumeIds.length === 0) {
    const notIn = [...excludeIds]
    const take = Math.max(limit * 4, limit + notIn.length)
    const recent = (await prisma.perfume.findMany({
      where: notIn.length > 0 ? { id: { notIn } } : undefined,
      take,
      orderBy: { createdAt: "desc" },
      select: PERFUME_SELECT,
    })) as PerfumeRow[]
    const filtered = recent
      .filter((p) => !excludeIds.has(p.id))
      .slice(0, limit)
    return filtered.map(
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
