import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import type { PerfumeDiscoveryFilters } from "@/utils/discovery-filters"
import {
  buildExchangeListingUserPerfumeWhere,
  fetchPerfumeIdsWithMatchingListings,
  fetchUserPerfumeIdsMatchingBottleTypes,
  hasExchangeListingFilters,
  mergeUserPerfumeListingWhere,
} from "@/utils/exchange-listing-filter.server"

const availableForDecantingWhere = {
  userPerfume: {
    some: {
      available: {
        not: "0",
      },
    },
  },
} as const

const availableForDecantingUserPerfumeSelect = {
  id: true,
  perfumeId: true,
  available: true,
  amount: true,
  price: true,
  tradePrice: true,
  tradePreference: true,
  tradeOnly: true,
  type: true,
  userId: true,
  images: true,
  condition: true,
  decantFormat: true,
  mlRemaining: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
    },
  },
  comments: {
    where: {
      isPublic: true,
    },
    select: {
      id: true,
      userId: true,
      perfumeId: true,
      userPerfumeId: true,
      comment: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  },
} as const

const availableForDecantingSelectBase = {
  id: true,
  name: true,
  description: true,
  image: true,
  slug: true,
  perfumeHouseId: true,
  createdAt: true,
  updatedAt: true,
  perfumeHouse: {
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
    },
  },
  userPerfume: {
    select: availableForDecantingUserPerfumeSelect,
  },
} as const

const buildAvailableForDecantingSelect = (
  listingWhere?: Prisma.UserPerfumeWhereInput
) => ({
  ...availableForDecantingSelectBase,
  userPerfume: {
    where: listingWhere ?? {
      available: {
        not: "0",
      },
    },
    select: availableForDecantingUserPerfumeSelect,
  },
})

export const getAvailablePerfumesForDecanting = async () => {
  const availablePerfumes = await prisma.perfume.findMany({
    where: availableForDecantingWhere,
    select: buildAvailableForDecantingSelect(),
    orderBy: {
      name: "asc",
    },
  })
  return availablePerfumes
}

interface GetAvailablePerfumesForDecantingPaginatedOptions {
  skip?: number
  take?: number
  search?: string
  discovery?: PerfumeDiscoveryFilters
}

/**
 * Text search + structured discovery filters for exchange listings (CF-010).
 * Exported for unit tests.
 */
export function buildExchangeDiscoveryWhereFragments(
  discovery: PerfumeDiscoveryFilters | undefined,
  search: string | undefined
): Prisma.PerfumeWhereInput[] {
  const parts: Prisma.PerfumeWhereInput[] = []
  const q = (search ?? "").trim()
  if (q) {
    parts.push({
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { perfumeHouse: { name: { contains: q, mode: "insensitive" as const } } },
      ],
    })
  }
  if (!discovery) return parts

  if (discovery.noteIds.length > 0) {
    parts.push({
      perfumeNoteRelations: { some: { noteId: { in: discovery.noteIds } } },
    })
  }
  if (discovery.seasons.length > 0) {
    parts.push({
      OR: discovery.seasons.map(s => ({
        userPerfumeSeasonVote: { some: { [s]: true } },
      })),
    })
  }
  if (discovery.houseId) {
    parts.push({ perfumeHouseId: discovery.houseId })
  }
  if (discovery.perfumeId) {
    parts.push({ id: discovery.perfumeId })
  }
  return parts
}

/**
 * Perfumes that have at least one in-stock listing whose `price` parses to the given numeric range.
 */
export async function fetchPerfumeIdsWithListingPriceInRange(
  minPrice: number | null,
  maxPrice: number | null
): Promise<string[]> {
  if (minPrice == null && maxPrice == null) return []

  const parts: Prisma.Sql[] = [
    Prisma.sql`up."available" <> '0'`,
    Prisma.sql`up.price IS NOT NULL`,
    Prisma.sql`TRIM(up.price) <> ''`,
    Prisma.sql`(NULLIF(REGEXP_REPLACE(TRIM(up.price), '[^0-9.]', '', 'g'), '')) ~ '^[0-9]+(\\.[0-9]+)?$'`,
  ]
  if (minPrice != null) {
    parts.push(
      Prisma.sql`(NULLIF(REGEXP_REPLACE(TRIM(up.price), '[^0-9.]', '', 'g'), ''))::numeric >= ${minPrice}`
    )
  }
  if (maxPrice != null) {
    parts.push(
      Prisma.sql`(NULLIF(REGEXP_REPLACE(TRIM(up.price), '[^0-9.]', '', 'g'), ''))::numeric <= ${maxPrice}`
    )
  }
  const whereClause = Prisma.join(parts, " AND ")
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT p.id AS id
    FROM "Perfume" p
    INNER JOIN "UserPerfume" up ON up."perfumeId" = p.id
    WHERE ${whereClause}
  `
  return rows.map(r => r.id)
}

export const getAvailablePerfumesForDecantingPaginated = async ({
  skip = 0,
  take = 16,
  search,
  discovery,
}: GetAvailablePerfumesForDecantingPaginatedOptions = {}) => {
  const discoveryFragments = buildExchangeDiscoveryWhereFragments(discovery, search)

  const andParts: Prisma.PerfumeWhereInput[] = [
    availableForDecantingWhere,
    ...discoveryFragments,
  ]

  if (
    discovery &&
    (discovery.minPrice != null || discovery.maxPrice != null)
  ) {
    const priceIds = await fetchPerfumeIdsWithListingPriceInRange(
      discovery.minPrice,
      discovery.maxPrice
    )
    andParts.push({ id: { in: priceIds } })
  }

  let nestedListingWhere: Prisma.UserPerfumeWhereInput = {
    available: { not: "0" },
  }

  if (discovery && hasExchangeListingFilters(discovery)) {
    const listingPerfumeIds = await fetchPerfumeIdsWithMatchingListings(discovery)
    andParts.push({ id: { in: listingPerfumeIds ?? [] } })

    const listingFilterWhere = buildExchangeListingUserPerfumeWhere(discovery)
    let bottleTypeIds: string[] | undefined
    if (discovery.bottleTypes.length > 0) {
      bottleTypeIds = await fetchUserPerfumeIdsMatchingBottleTypes(
        discovery.bottleTypes
      )
    }
    nestedListingWhere = mergeUserPerfumeListingWhere(
      { available: { not: "0" } },
      listingFilterWhere,
      bottleTypeIds
    )
  }

  const whereClause: Prisma.PerfumeWhereInput =
    andParts.length === 1 ? andParts[0]! : { AND: andParts }

  const select = buildAvailableForDecantingSelect(nestedListingWhere)

  const [perfumes, totalCount] = await Promise.all([
    prisma.perfume.findMany({
      where: whereClause,
      select,
      orderBy: {
        name: "asc",
      },
      skip,
      take,
    }),
    prisma.perfume.count({
      where: whereClause,
    }),
  ])

  const pageSize = take
  const hasAnyData = totalCount > 0 && pageSize > 0
  const totalPages = hasAnyData ? Math.ceil(totalCount / pageSize) : 0
  const calculatedPage = pageSize > 0 ? Math.floor(skip / pageSize) + 1 : 1
  const currentPage = hasAnyData ? Math.min(calculatedPage, totalPages) : 1
  const hasMore = hasAnyData ? skip + perfumes.length < totalCount : false
  const hasNextPage = hasAnyData ? currentPage < totalPages : false
  const hasPrevPage = hasAnyData ? currentPage > 1 : false

  return {
    perfumes,
    meta: {
      totalCount,
      pageSize,
      currentPage,
      totalPages,
      hasMore,
      hasNextPage,
      hasPrevPage,
    },
  }
}

export const getPerfumesByLetterPaginated = async (
  letter: string,
  options: { skip: number; take: number }
) => {
  const { skip, take } = options

  const [perfumes, totalCount] = await Promise.all([
    prisma.perfume.findMany({
      where: {
        name: {
          startsWith: letter,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        slug: true,
        perfumeHouseId: true,
        createdAt: true,
        updatedAt: true,
        perfumeHouse: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    prisma.perfume.count({
      where: {
        name: {
          startsWith: letter,
          mode: "insensitive",
        },
      },
    }),
  ])

  return {
    perfumes,
    count: totalCount,
  }
}
