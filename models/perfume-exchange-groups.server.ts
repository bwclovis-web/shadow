import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { loadTraderReputationsForUserIds } from "@/services/reputation/loadReputationInputs.server"
import { getTraderDisplayName } from "@/utils/user"
import {
  DEFAULT_EXCHANGE_GROUP_SORT,
  EXCHANGE_GROUP_PAGE_SIZE,
  EXCHANGE_MIN_REP_TRADER_CAP,
  EXCHANGE_OFFER_PAGE_SIZE,
  EXCHANGE_PREVIEW_IMAGE_MAX,
  type ExchangeGroupSort,
} from "@/utils/exchange-constants"
import type { PerfumeDiscoveryFilters } from "@/utils/discovery-filters"
import {
  buildExchangeListingUserPerfumeWhere,
  fetchUserPerfumeIdsMatchingBottleTypes,
  fetchUserPerfumeIdsWithListingPriceInRange,
  mergeUserPerfumeListingWhere,
} from "@/utils/exchange-listing-filter.server"

import type {
  ExchangeFragranceGroupDto,
  ExchangeFragranceGroupsPageMeta,
  ExchangeOfferDto,
  ExchangeOffersPage,
  ExchangePreviewDto,
} from "@/types/exchange-discovery"

import { buildExchangeDiscoveryWhereFragments } from "./perfume-exchange.server"

export type {
  ExchangeFragranceGroupDto,
  ExchangeOfferDto,
  ExchangeOffersPage,
  ExchangePreviewDto,
} from "@/types/exchange-discovery"

export type ExchangeFragranceGroupsPage = {
  groups: ExchangeFragranceGroupDto[]
  meta: ExchangeFragranceGroupsPageMeta
}

export type ExchangeEligibility = {
  perfumeWhere: Prisma.PerfumeWhereInput
  listingWhere: Prisma.UserPerfumeWhereInput
}

const offerUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
} as const

const offerSelect = {
  id: true,
  perfumeId: true,
  userId: true,
  available: true,
  amount: true,
  price: true,
  tradePrice: true,
  tradePreference: true,
  tradeOnly: true,
  type: true,
  images: true,
  condition: true,
  decantFormat: true,
  mlRemaining: true,
  user: { select: offerUserSelect },
} as const

/**
 * Shared eligibility for fragrance groups, counts, previews, and on-demand offers.
 * Every offer-level predicate is AND’d on the same UserPerfume row.
 */
export const resolveExchangeEligibility = async (options: {
  search?: string
  discovery?: PerfumeDiscoveryFilters
  viewerId?: string | null
}): Promise<ExchangeEligibility> => {
  const { search, discovery, viewerId } = options

  let listingWhere: Prisma.UserPerfumeWhereInput = {
    available: { not: "0" },
  }
  if (viewerId) {
    listingWhere = { ...listingWhere, userId: { not: viewerId } }
  }

  const listingFilterWhere = buildExchangeListingUserPerfumeWhere(discovery)
  let bottleTypeIds: string[] | undefined
  if (discovery && discovery.bottleTypes.length > 0) {
    bottleTypeIds = await fetchUserPerfumeIdsMatchingBottleTypes(
      discovery.bottleTypes
    )
    if (bottleTypeIds.length === 0) {
      return emptyEligibility()
    }
  }

  let priceIds: string[] | undefined
  if (
    discovery &&
    (discovery.minPrice != null || discovery.maxPrice != null)
  ) {
    priceIds = await fetchUserPerfumeIdsWithListingPriceInRange(
      discovery.minPrice,
      discovery.maxPrice
    )
    if (priceIds.length === 0) {
      return emptyEligibility()
    }
  }

  listingWhere = mergeUserPerfumeListingWhere(
    listingWhere,
    listingFilterWhere,
    bottleTypeIds
  )
  if (priceIds) {
    listingWhere = mergeUserPerfumeListingWhere(listingWhere, undefined, priceIds)
  }

  if (discovery?.minRep != null) {
    const eligibleUserIds = await resolveMinRepEligibleUserIds(
      listingWhere,
      discovery.minRep
    )
    if (eligibleUserIds.length === 0) {
      return emptyEligibility()
    }
    listingWhere = mergeUserPerfumeListingWhere(listingWhere, {
      userId: { in: eligibleUserIds },
    })
  }

  const discoveryFragments = buildExchangeDiscoveryWhereFragments(
    discovery,
    search
  )
  const perfumeWhere: Prisma.PerfumeWhereInput = {
    AND: [{ userPerfume: { some: listingWhere } }, ...discoveryFragments],
  }

  return { perfumeWhere, listingWhere }
}

const emptyEligibility = (): ExchangeEligibility => ({
  perfumeWhere: { id: { in: [] } },
  listingWhere: { id: { in: [] } },
})

const resolveMinRepEligibleUserIds = async (
  listingWhere: Prisma.UserPerfumeWhereInput,
  minRep: number
): Promise<string[]> => {
  const traders = await prisma.userPerfume.findMany({
    where: listingWhere,
    select: { userId: true },
    distinct: ["userId"],
    orderBy: { userId: "asc" },
    take: EXCHANGE_MIN_REP_TRADER_CAP,
  })
  const userIds = traders.map(t => t.userId)
  if (userIds.length === 0) return []

  const reputationMap = await loadTraderReputationsForUserIds(userIds)
  return userIds.filter(id => {
    const score = reputationMap.get(id)?.score
    return score != null && score >= minRep
  })
}

type PerfumeRow = {
  id: string
  name: string
  slug: string
  image: string | null
  perfumeHouse: { id: string; name: string; slug: string } | null
}

const perfumeBrowseSelect = {
  id: true,
  name: true,
  slug: true,
  image: true,
  perfumeHouse: {
    select: { id: true, name: true, slug: true },
  },
} as const

const fetchPerfumeRowsBySort = async (options: {
  sort: ExchangeGroupSort
  perfumeWhere: Prisma.PerfumeWhereInput
  listingWhere: Prisma.UserPerfumeWhereInput
  skip: number
  take: number
}): Promise<PerfumeRow[]> => {
  const { sort, perfumeWhere, listingWhere, skip, take } = options

  if (sort === "offers-newest") {
    const ranked = await prisma.userPerfume.groupBy({
      by: ["perfumeId"],
      where: {
        AND: [listingWhere, { perfume: perfumeWhere }],
      },
      _max: { createdAt: true },
      orderBy: [{ _max: { createdAt: "desc" } }, { perfumeId: "asc" }],
      skip,
      take,
    })
    if (ranked.length === 0) return []

    const ids = ranked.map(row => row.perfumeId)
    const rows = await prisma.perfume.findMany({
      where: { id: { in: ids } },
      select: perfumeBrowseSelect,
    })
    const byId = new Map(rows.map(row => [row.id, row]))
    return ids.flatMap(id => {
      const row = byId.get(id)
      return row ? [row] : []
    })
  }

  return prisma.perfume.findMany({
    where: perfumeWhere,
    select: perfumeBrowseSelect,
    orderBy:
      sort === "name-desc"
        ? [{ name: "desc" }, { id: "asc" }]
        : [{ name: "asc" }, { id: "asc" }],
    skip,
    take,
  })
}

export const getExchangeFragranceGroupsPage = async (options: {
  page?: number
  pageSize?: number
  search?: string
  discovery?: PerfumeDiscoveryFilters
  viewerId?: string | null
  sort?: ExchangeGroupSort
}): Promise<ExchangeFragranceGroupsPage> => {
  const pageSize = Math.min(
    Math.max(options.pageSize ?? EXCHANGE_GROUP_PAGE_SIZE, 1),
    EXCHANGE_GROUP_PAGE_SIZE
  )
  const requestedPage = Math.max(options.page ?? 1, 1)
  const sort = options.sort ?? DEFAULT_EXCHANGE_GROUP_SORT

  const { perfumeWhere, listingWhere } = await resolveExchangeEligibility({
    search: options.search,
    discovery: options.discovery,
    viewerId: options.viewerId,
  })

  const totalCount = await prisma.perfume.count({ where: perfumeWhere })
  const hasAnyData = totalCount > 0
  const totalPages = hasAnyData ? Math.ceil(totalCount / pageSize) : 0
  const currentPage = hasAnyData
    ? Math.min(requestedPage, totalPages)
    : 1
  const skip = hasAnyData ? (currentPage - 1) * pageSize : 0

  const perfumeRows = hasAnyData
    ? await fetchPerfumeRowsBySort({
        sort,
        perfumeWhere,
        listingWhere,
        skip,
        take: pageSize,
      })
    : []

  const groups = await attachCountsAndPreviews(perfumeRows, listingWhere)

  return {
    groups,
    meta: {
      totalCount,
      pageSize,
      currentPage,
      totalPages,
      hasMore: hasAnyData ? skip + perfumeRows.length < totalCount : false,
      hasNextPage: hasAnyData ? currentPage < totalPages : false,
      hasPrevPage: hasAnyData ? currentPage > 1 : false,
    },
  }
}

const attachCountsAndPreviews = async (
  perfumeRows: PerfumeRow[],
  listingWhere: Prisma.UserPerfumeWhereInput
): Promise<ExchangeFragranceGroupDto[]> => {
  if (perfumeRows.length === 0) return []

  const ids = perfumeRows.map(p => p.id)

  // Counts share listingWhere via Prisma; previews pick ≤3 ids per perfume.
  const [countRows, previewRows] = await Promise.all([
    prisma.userPerfume.groupBy({
      by: ["perfumeId"],
      where: {
        perfumeId: { in: ids },
        AND: [listingWhere],
      },
      _count: { _all: true },
    }),
    fetchPreviewRowsForPerfumes(ids, listingWhere),
  ])

  const collectorRows = await prisma.userPerfume.findMany({
    where: {
      perfumeId: { in: ids },
      AND: [listingWhere],
    },
    select: { perfumeId: true, userId: true },
    distinct: ["perfumeId", "userId"],
  })

  const offerCountByPerfume = new Map(
    countRows.map(r => [r.perfumeId, r._count._all])
  )
  const collectorsByPerfume = new Map<string, Set<string>>()
  for (const row of collectorRows) {
    const set = collectorsByPerfume.get(row.perfumeId) ?? new Set()
    set.add(row.userId)
    collectorsByPerfume.set(row.perfumeId, set)
  }

  const previewsByPerfume = new Map<string, ExchangePreviewDto[]>()
  for (const row of previewRows) {
    const list = previewsByPerfume.get(row.perfumeId) ?? []
    if (list.length >= EXCHANGE_PREVIEW_IMAGE_MAX) continue
    const url = row.images.find(u => typeof u === "string" && u.trim())?.trim()
    if (!url) continue
    list.push({
      userPerfumeId: row.id,
      userId: row.userId,
      url,
      traderName: getTraderDisplayName(row.user),
      condition: row.condition,
      tradePreference: row.tradePreference,
      tradeOnly: row.tradeOnly,
      user: row.user,
    })
    previewsByPerfume.set(row.perfumeId, list)
  }

  return perfumeRows.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.image,
    perfumeHouse: p.perfumeHouse,
    offerCount: offerCountByPerfume.get(p.id) ?? 0,
    collectorCount: collectorsByPerfume.get(p.id)?.size ?? 0,
    previews: previewsByPerfume.get(p.id) ?? [],
  }))
}

type PreviewRow = {
  id: string
  perfumeId: string
  userId: string
  images: string[]
  condition: ExchangePreviewDto["condition"]
  tradePreference: string | null
  tradeOnly: boolean
  user: ExchangePreviewDto["user"]
}

/**
 * Up to {@link EXCHANGE_PREVIEW_IMAGE_MAX} attributed listing photos per perfume.
 * One bounded query per perfume on the page (≤24 × 3 rows) — same listingWhere.
 */
const fetchPreviewRowsForPerfumes = async (
  ids: string[],
  listingWhere: Prisma.UserPerfumeWhereInput
): Promise<PreviewRow[]> => {
  const chunks = await Promise.all(
    ids.map(perfumeId =>
      prisma.userPerfume.findMany({
        where: {
          perfumeId,
          AND: [listingWhere, { NOT: { images: { equals: [] } } }],
        },
        select: {
          id: true,
          perfumeId: true,
          userId: true,
          images: true,
          condition: true,
          tradePreference: true,
          tradeOnly: true,
          user: { select: offerUserSelect },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: EXCHANGE_PREVIEW_IMAGE_MAX,
      })
    )
  )
  return chunks.flat()
}

/**
 * On-demand matching offers for one fragrance. Cursor is the last offer `id`
 * from the previous page (stable with updatedAt+id ordering).
 */
export const getExchangeMatchingOffersPage = async (options: {
  perfumeId: string
  search?: string
  discovery?: PerfumeDiscoveryFilters
  viewerId?: string | null
  cursor?: string | null
  take?: number
}): Promise<ExchangeOffersPage> => {
  const take = Math.min(
    Math.max(options.take ?? EXCHANGE_OFFER_PAGE_SIZE, 1),
    EXCHANGE_OFFER_PAGE_SIZE
  )

  const { perfumeWhere, listingWhere } = await resolveExchangeEligibility({
    search: options.search,
    discovery: options.discovery,
    viewerId: options.viewerId,
  })

  const perfumeOk = await prisma.perfume.findFirst({
    where: { AND: [{ id: options.perfumeId }, perfumeWhere] },
    select: { id: true },
  })
  if (!perfumeOk) {
    return { offers: [], nextCursor: null, pageSize: take }
  }

  let cursorFilter: Prisma.UserPerfumeWhereInput | undefined
  if (options.cursor) {
    const cursorRow = await prisma.userPerfume.findFirst({
      where: {
        id: options.cursor,
        perfumeId: options.perfumeId,
      },
      select: { id: true, updatedAt: true },
    })
    if (cursorRow) {
      cursorFilter = {
        OR: [
          { updatedAt: { lt: cursorRow.updatedAt } },
          {
            AND: [
              { updatedAt: cursorRow.updatedAt },
              { id: { lt: cursorRow.id } },
            ],
          },
        ],
      }
    }
  }

  const rows = await prisma.userPerfume.findMany({
    where: {
      perfumeId: options.perfumeId,
      AND: [listingWhere, ...(cursorFilter ? [cursorFilter] : [])],
    },
    select: offerSelect,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: take + 1,
  })

  const pageRows = rows.slice(0, take)
  const hasMore = rows.length > take
  const last = pageRows[pageRows.length - 1]

  return {
    offers: pageRows.map(toOfferDto),
    nextCursor: hasMore && last ? last.id : null,
    pageSize: take,
  }
}

const toOfferDto = (
  row: Prisma.UserPerfumeGetPayload<{ select: typeof offerSelect }>
): ExchangeOfferDto => ({
  id: row.id,
  perfumeId: row.perfumeId,
  userId: row.userId,
  available: row.available,
  amount: row.amount,
  price: row.price,
  tradePrice: row.tradePrice,
  tradePreference: row.tradePreference,
  tradeOnly: row.tradeOnly,
  type: row.type,
  images: row.images,
  condition: row.condition,
  decantFormat: row.decantFormat,
  mlRemaining: row.mlRemaining,
  user: row.user,
})
