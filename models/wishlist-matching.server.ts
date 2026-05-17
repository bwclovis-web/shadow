import { prisma } from "@/lib/db"

const traderUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  avatarImage: true,
} as const

const exchangeMatchListingSelect = {
  id: true,
  userId: true,
  available: true,
  type: true,
  tradePreference: true,
  tradeOnly: true,
  price: true,
  tradePrice: true,
  images: true,
  condition: true,
  decantFormat: true,
  mlRemaining: true,
  user: { select: traderUserSelect },
} as const

const exchangeMatchPerfumeSelect = {
  id: true,
  name: true,
  slug: true,
  image: true,
  perfumeHouse: {
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
    },
  },
  userPerfume: {
    where: {
      available: { not: "0" },
    },
    select: exchangeMatchListingSelect,
  },
} as const

export type WishlistExchangeMatchRow = {
  id: string
  name: string
  slug: string
  image: string | null
  perfumeHouse: {
    id: string
    name: string
    slug: string
    type: string
  } | null
  userPerfume: Array<{
    id: string
    userId: string
    available: string
    type: string | null
    tradePreference: string | null
    tradeOnly: boolean
    price: string | null
    tradePrice: string | null
    images: string[]
    condition: "sealed" | "mint" | "lightlyUsed" | "heavilyUsed" | "damaged" | null
    decantFormat: "atomizer" | "vial" | "original" | null
    mlRemaining: number | null
    user: {
      id: string
      firstName: string | null
      lastName: string | null
      username: string | null
      email: string
      avatarImage: string | null
    }
  }>
}

export type TraderWantingUserListingRow = {
  trader: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string
    avatarImage: string | null
  }
  perfumes: Array<{
    id: string
    name: string
    slug: string
    image: string | null
  }>
}

export type TraderWishlistOverlap = {
  matchingPerfumes: Array<{
    id: string
    name: string
    slug: string
  }>
}

const WISHLIST_EXCHANGE_MATCH_LIMIT = 12
const TRADERS_WANTING_LISTINGS_LIMIT = 24

/**
 * Listings on the exchange for perfumes on the viewer's wishlist (IMP-140).
 */
export const getWishlistExchangeMatches = async (
  viewerId: string,
  limit = WISHLIST_EXCHANGE_MATCH_LIMIT
): Promise<WishlistExchangeMatchRow[]> => {
  const wishlistRows = await prisma.userPerfumeWishlist.findMany({
    where: { userId: viewerId },
    select: { perfumeId: true },
  })
  const perfumeIds = [...new Set(wishlistRows.map(row => row.perfumeId))]
  if (perfumeIds.length === 0) return []

  const perfumes = await prisma.perfume.findMany({
    where: {
      id: { in: perfumeIds },
      userPerfume: {
        some: {
          available: { not: "0" },
          userId: { not: viewerId },
        },
      },
    },
    select: {
      ...exchangeMatchPerfumeSelect,
      userPerfume: {
        where: {
          available: { not: "0" },
          userId: { not: viewerId },
          perfumeId: { in: perfumeIds },
        },
        select: exchangeMatchListingSelect,
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  })

  return perfumes.filter(p => p.userPerfume.length > 0)
}

/**
 * Traders whose public wishlist includes a perfume the user has listed (IMP-141).
 */
export const getTradersWantingUserListings = async (
  userId: string,
  limit = TRADERS_WANTING_LISTINGS_LIMIT
): Promise<TraderWantingUserListingRow[]> => {
  const listed = await prisma.userPerfume.findMany({
    where: {
      userId,
      available: { not: "0" },
    },
    select: {
      perfumeId: true,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
        },
      },
    },
  })

  const perfumeIds = [...new Set(listed.map(row => row.perfumeId))]
  if (perfumeIds.length === 0) return []

  const wishlistHits = await prisma.userPerfumeWishlist.findMany({
    where: {
      perfumeId: { in: perfumeIds },
      userId: { not: userId },
      isPublic: true,
    },
    select: {
      userId: true,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
        },
      },
      user: { select: traderUserSelect },
    },
    orderBy: { createdAt: "desc" },
  })

  const byTrader = new Map<string, TraderWantingUserListingRow>()

  for (const hit of wishlistHits) {
    const existing = byTrader.get(hit.userId)
    if (existing) {
      if (!existing.perfumes.some(p => p.id === hit.perfume.id)) {
        existing.perfumes.push(hit.perfume)
      }
      continue
    }
    if (byTrader.size >= limit) break
    byTrader.set(hit.userId, {
      trader: hit.user,
      perfumes: [hit.perfume],
    })
  }

  return [...byTrader.values()]
}

/**
 * Perfumes the viewer has listed that appear on the trader's public wishlist (IMP-142).
 */
export const getViewerOverlapWithTraderWishlist = async (
  viewerId: string | null | undefined,
  traderId: string
): Promise<TraderWishlistOverlap | null> => {
  if (!viewerId || viewerId === traderId) return null

  const traderWishlist = await prisma.userPerfumeWishlist.findMany({
    where: {
      userId: traderId,
      isPublic: true,
    },
    select: { perfumeId: true },
  })

  const wishlistPerfumeIds = traderWishlist.map(row => row.perfumeId)
  if (wishlistPerfumeIds.length === 0) return null

  const overlaps = await prisma.userPerfume.findMany({
    where: {
      userId: viewerId,
      perfumeId: { in: wishlistPerfumeIds },
      available: { not: "0" },
    },
    select: {
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    distinct: ["perfumeId"],
  })

  if (overlaps.length === 0) return null

  return {
    matchingPerfumes: overlaps.map(row => row.perfume),
  }
}
