import type { Prisma, WishlistBottlePreference } from "@prisma/client"

import { prisma } from "@/lib/db"
import { resolveExchangeEligibility } from "@/models/perfume-exchange-groups.server"
import type {
  OwnedSeekingPageResult,
  PublicSeekingItemDto,
  PublicSeekingPageQueryOptions,
  PublicSeekingPageResult,
  SeekingAvailabilityStatus,
  SeekingGroupPage,
  SeekingGroupPageMeta,
  SeekingGroupQueryOptions,
  SeekingVisibilityCounts,
  SeekingWishlistItemDto,
} from "@/types/seeking"
import {
  clampSeekingPage,
  clampSeekingPageSize,
  DEFAULT_SEEKING_VISIBILITY,
  normalizeSeekingSearch,
  type SeekingVisibilityFilter,
} from "@/utils/seeking-constants"

export class SeekingAvailabilityError extends Error {
  readonly code = "SEEKING_AVAILABILITY_FAILED" as const

  constructor(message = "Seeking availability lookup failed", cause?: unknown) {
    super(message)
    this.name = "SeekingAvailabilityError"
    if (cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = cause
    }
  }
}

const wishlistItemSelect = {
  id: true,
  perfumeId: true,
  isPublic: true,
  bottlePreference: true,
  createdAt: true,
  perfume: {
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      perfumeHouse: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
} as const

type WishlistItemRow = Prisma.UserPerfumeWishlistGetPayload<{
  select: typeof wishlistItemSelect
}>

const wishlistOrderBy: Prisma.UserPerfumeWishlistOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
]

/**
 * Perfume name / house search fragment. Preferred format is intentionally
 * omitted — availability does not depend on `bottlePreference`.
 */
export const buildSeekingPerfumeSearchWhere = (
  search: string
): Prisma.PerfumeWhereInput | undefined => {
  const q = normalizeSeekingSearch(search)
  if (!q) return undefined
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { perfumeHouse: { name: { contains: q, mode: "insensitive" } } },
    ],
  }
}

export const buildOwnerWishlistVisibilityWhere = (
  ownerUserId: string,
  visibility: SeekingVisibilityFilter = DEFAULT_SEEKING_VISIBILITY
): Prisma.UserPerfumeWishlistWhereInput => {
  const where: Prisma.UserPerfumeWishlistWhereInput = { userId: ownerUserId }
  if (visibility === "public") where.isPublic = true
  if (visibility === "private") where.isPublic = false
  return where
}

/**
 * Owner-scoped wishlist predicate (visibility + optional perfume/house search).
 * Does not include Exchange eligibility — callers AND that separately for groups.
 */
export const buildOwnerSeekingWishlistWhere = (options: {
  ownerUserId: string
  visibility?: SeekingVisibilityFilter
  search?: string | null
  perfumeExtra?: Prisma.PerfumeWhereInput
}): Prisma.UserPerfumeWishlistWhereInput => {
  const visibility = options.visibility ?? DEFAULT_SEEKING_VISIBILITY
  const searchWhere = buildSeekingPerfumeSearchWhere(options.search ?? "")
  const perfumeParts: Prisma.PerfumeWhereInput[] = []
  if (searchWhere) perfumeParts.push(searchWhere)
  if (options.perfumeExtra) perfumeParts.push(options.perfumeExtra)

  const base = buildOwnerWishlistVisibilityWhere(options.ownerUserId, visibility)
  if (perfumeParts.length === 0) return base

  return {
    ...base,
    perfume:
      perfumeParts.length === 1 ? perfumeParts[0]! : { AND: perfumeParts },
  }
}

/**
 * Eligible Exchange listing predicate for Seeking availability.
 * Reuses Exchange eligibility (available ≠ "0", exclude own listings) and
 * adds non-banned sellers. Does not consult preferred format.
 */
export const resolveSeekingEligibleListingWhere = async (
  ownerUserId: string
): Promise<Prisma.UserPerfumeWhereInput> => {
  try {
    const { listingWhere } = await resolveExchangeEligibility({
      viewerId: ownerUserId,
    })
    return {
      AND: [listingWhere, { user: { isBanned: false } }],
    }
  } catch (cause) {
    throw new SeekingAvailabilityError(
      "Failed to resolve Seeking Exchange eligibility",
      cause
    )
  }
}

const emptyGroupMeta = (pageSize: number): SeekingGroupPageMeta => ({
  totalCount: 0,
  pageSize,
  currentPage: 1,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
  showingFrom: 0,
  showingTo: 0,
})

const emptyGroupPage = (pageSize: number): SeekingGroupPage => ({
  items: [],
  meta: emptyGroupMeta(pageSize),
})

const buildGroupMeta = (
  totalCount: number,
  pageSize: number,
  currentPage: number,
  totalPages: number,
  itemCount: number
): SeekingGroupPageMeta => {
  const showingFrom =
    totalCount === 0 || itemCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const showingTo =
    totalCount === 0 || itemCount === 0 ? 0 : showingFrom + itemCount - 1
  return {
    totalCount,
    pageSize,
    currentPage,
    totalPages,
    hasNextPage: totalPages > 0 && currentPage < totalPages,
    hasPrevPage: totalPages > 0 && currentPage > 1,
    showingFrom,
    showingTo,
  }
}

const toDto = (
  row: WishlistItemRow,
  offerCount: number,
  collectorCount: number
): SeekingWishlistItemDto => ({
  id: row.id,
  perfumeId: row.perfumeId,
  isPublic: row.isPublic,
  bottlePreference: row.bottlePreference as WishlistBottlePreference,
  createdAt: row.createdAt,
  perfume: row.perfume,
  offerCount,
  collectorCount,
})

/**
 * Offer row counts + distinct collectors for a bounded perfume id set.
 * Does not load full offer payloads or infer ml from ambiguous quantities.
 */
export const loadSeekingOfferCollectorCounts = async (
  perfumeIds: string[],
  listingWhere: Prisma.UserPerfumeWhereInput
): Promise<Map<string, { offerCount: number; collectorCount: number }>> => {
  const result = new Map<string, { offerCount: number; collectorCount: number }>()
  if (perfumeIds.length === 0) return result

  const [offerRows, collectorRows] = await Promise.all([
    prisma.userPerfume.groupBy({
      by: ["perfumeId"],
      where: {
        perfumeId: { in: perfumeIds },
        AND: [listingWhere],
      },
      _count: { _all: true },
    }),
    prisma.userPerfume.findMany({
      where: {
        perfumeId: { in: perfumeIds },
        AND: [listingWhere],
      },
      select: { perfumeId: true, userId: true },
      distinct: ["perfumeId", "userId"],
    }),
  ])

  const collectorsByPerfume = new Map<string, Set<string>>()
  for (const row of collectorRows) {
    const set = collectorsByPerfume.get(row.perfumeId) ?? new Set<string>()
    set.add(row.userId)
    collectorsByPerfume.set(row.perfumeId, set)
  }

  for (const id of perfumeIds) {
    result.set(id, {
      offerCount: 0,
      collectorCount: collectorsByPerfume.get(id)?.size ?? 0,
    })
  }
  for (const row of offerRows) {
    result.set(row.perfumeId, {
      offerCount: row._count._all,
      collectorCount: collectorsByPerfume.get(row.perfumeId)?.size ?? 0,
    })
  }

  return result
}

const fetchSeekingGroupPage = async (options: {
  ownerUserId: string
  search?: string | null
  visibility?: SeekingVisibilityFilter
  page?: number
  pageSize?: number
  listingWhere: Prisma.UserPerfumeWhereInput
  /** `some` = Available; `none` = Still seeking (no eligible offer). */
  eligibilityMode: "some" | "none"
  includeOfferCounts: boolean
}): Promise<SeekingGroupPage> => {
  const pageSize = clampSeekingPageSize(options.pageSize)
  const perfumeExtra: Prisma.PerfumeWhereInput = {
    userPerfume:
      options.eligibilityMode === "some"
        ? { some: options.listingWhere }
        : { none: options.listingWhere },
  }

  const where = buildOwnerSeekingWishlistWhere({
    ownerUserId: options.ownerUserId,
    visibility: options.visibility,
    search: options.search,
    perfumeExtra,
  })

  const totalCount = await prisma.userPerfumeWishlist.count({ where })
  const { currentPage, totalPages, skip } = clampSeekingPage(
    options.page ?? 1,
    totalCount,
    pageSize
  )

  if (totalCount === 0) {
    return emptyGroupPage(pageSize)
  }

  const rows = await prisma.userPerfumeWishlist.findMany({
    where,
    select: wishlistItemSelect,
    orderBy: wishlistOrderBy,
    skip,
    take: pageSize,
  })

  let countMap = new Map<string, { offerCount: number; collectorCount: number }>()
  if (options.includeOfferCounts && rows.length > 0) {
    countMap = await loadSeekingOfferCollectorCounts(
      rows.map(r => r.perfumeId),
      options.listingWhere
    )
  }

  const items = rows.map(row => {
    const counts = countMap.get(row.perfumeId)
    return toDto(row, counts?.offerCount ?? 0, counts?.collectorCount ?? 0)
  })

  return {
    items,
    meta: buildGroupMeta(
      totalCount,
      pageSize,
      currentPage,
      totalPages,
      items.length
    ),
  }
}

/** Available on the Exchange: ≥1 eligible offer exists (relational `some`). */
export const getSeekingAvailableGroupPage = async (
  options: SeekingGroupQueryOptions
): Promise<SeekingGroupPage> => {
  const listingWhere = await resolveSeekingEligibleListingWhere(
    options.ownerUserId
  )
  return fetchSeekingGroupPage({
    ...options,
    listingWhere,
    eligibilityMode: "some",
    includeOfferCounts: true,
  })
}

/**
 * Still seeking: no eligible offer exists (relational `none`).
 * Must not be used as a fallback when eligibility resolution fails —
 * callers should catch {@link SeekingAvailabilityError} instead.
 */
export const getSeekingStillSeekingGroupPage = async (
  options: SeekingGroupQueryOptions
): Promise<SeekingGroupPage> => {
  const listingWhere = await resolveSeekingEligibleListingWhere(
    options.ownerUserId
  )
  return fetchSeekingGroupPage({
    ...options,
    listingWhere,
    eligibilityMode: "none",
    includeOfferCounts: false,
  })
}

export const getOwnedSeekingHeroTotal = async (
  ownerUserId: string
): Promise<number> =>
  prisma.userPerfumeWishlist.count({
    where: { userId: ownerUserId },
  })

/**
 * Visibility pill counts for the active search. Each pill uses the same
 * search predicate; visibility differs only on that pill's `isPublic` filter.
 */
export const getOwnedSeekingVisibilityCounts = async (options: {
  ownerUserId: string
  search?: string | null
}): Promise<SeekingVisibilityCounts> => {
  const search = options.search
  const [all, publicCount, privateCount] = await Promise.all([
    prisma.userPerfumeWishlist.count({
      where: buildOwnerSeekingWishlistWhere({
        ownerUserId: options.ownerUserId,
        visibility: "all",
        search,
      }),
    }),
    prisma.userPerfumeWishlist.count({
      where: buildOwnerSeekingWishlistWhere({
        ownerUserId: options.ownerUserId,
        visibility: "public",
        search,
      }),
    }),
    prisma.userPerfumeWishlist.count({
      where: buildOwnerSeekingWishlistWhere({
        ownerUserId: options.ownerUserId,
        visibility: "private",
        search,
      }),
    }),
  ])
  return { all, public: publicCount, private: privateCount }
}

/**
 * Owned Seeking page payload: hero total, visibility counts, and both groups.
 * Groups share one eligibility resolution. On eligibility failure, both group
 * pages are empty and `availabilityStatus` is `failed` (not Still seeking).
 */
export const getOwnedSeekingPage = async (options: {
  ownerUserId: string
  search?: string | null
  visibility?: SeekingVisibilityFilter
  availablePage?: number
  stillSeekingPage?: number
  pageSize?: number
}): Promise<OwnedSeekingPageResult> => {
  const visibility = options.visibility ?? DEFAULT_SEEKING_VISIBILITY
  const search = normalizeSeekingSearch(options.search)
  const pageSize = clampSeekingPageSize(options.pageSize)

  const [heroTotalCount, visibilityCounts] = await Promise.all([
    getOwnedSeekingHeroTotal(options.ownerUserId),
    getOwnedSeekingVisibilityCounts({
      ownerUserId: options.ownerUserId,
      search,
    }),
  ])

  let availabilityStatus: SeekingAvailabilityStatus = "ok"
  let available = emptyGroupPage(pageSize)
  let stillSeeking = emptyGroupPage(pageSize)

  try {
    const listingWhere = await resolveSeekingEligibleListingWhere(
      options.ownerUserId
    )
    ;[available, stillSeeking] = await Promise.all([
      fetchSeekingGroupPage({
        ownerUserId: options.ownerUserId,
        search,
        visibility,
        page: options.availablePage,
        pageSize,
        listingWhere,
        eligibilityMode: "some",
        includeOfferCounts: true,
      }),
      fetchSeekingGroupPage({
        ownerUserId: options.ownerUserId,
        search,
        visibility,
        page: options.stillSeekingPage,
        pageSize,
        listingWhere,
        eligibilityMode: "none",
        includeOfferCounts: false,
      }),
    ])
  } catch (error) {
    if (error instanceof SeekingAvailabilityError) {
      availabilityStatus = "failed"
    } else {
      throw error
    }
  }

  return {
    ownerUserId: options.ownerUserId,
    heroTotalCount,
    visibilityCounts,
    search,
    visibility,
    available,
    stillSeeking,
    availabilityStatus,
  }
}

const publicWishlistItemSelect = {
  id: true,
  perfumeId: true,
  bottlePreference: true,
  createdAt: true,
  perfume: {
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      perfumeHouse: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
} as const

/**
 * Public shared Seeking page. `isPublic: true` is applied in the server where
 * before count/pagination — private rows are never loaded or returned.
 * No Exchange availability grouping on the public surface.
 */
export const getPublicSeekingPage = async (
  options: PublicSeekingPageQueryOptions
): Promise<PublicSeekingPageResult> => {
  const pageSize = clampSeekingPageSize(options.pageSize)
  const where: Prisma.UserPerfumeWishlistWhereInput = {
    userId: options.ownerUserId,
    isPublic: true,
  }

  const totalCount = await prisma.userPerfumeWishlist.count({ where })
  const { currentPage, totalPages, skip } = clampSeekingPage(
    options.page ?? 1,
    totalCount,
    pageSize
  )

  if (totalCount === 0) {
    return {
      ownerUserId: options.ownerUserId,
      items: [],
      meta: emptyGroupMeta(pageSize),
    }
  }

  const rows = await prisma.userPerfumeWishlist.findMany({
    where,
    select: publicWishlistItemSelect,
    orderBy: wishlistOrderBy,
    skip,
    take: pageSize,
  })

  const items: PublicSeekingItemDto[] = rows.map(row => ({
    id: row.id,
    perfumeId: row.perfumeId,
    bottlePreference: row.bottlePreference as WishlistBottlePreference,
    createdAt: row.createdAt,
    perfume: row.perfume,
  }))

  return {
    ownerUserId: options.ownerUserId,
    items,
    meta: buildGroupMeta(
      totalCount,
      pageSize,
      currentPage,
      totalPages,
      items.length
    ),
  }
}
