import { prisma } from "@/lib/db"
import { getOrCreateScentProfile } from "@/models/scent-profile.server"
import {
  scoreListingPreferenceAlignment,
  signalsFromScentProfileFields,
} from "@/utils/scent-profile-preferences"

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

type RankableListing = {
  type: string | null
  price: string | null
  decantFormat?: "atomizer" | "vial" | "original" | null
  mlRemaining?: number | null
  available?: string
}

/** Score how well a listing matches wishlist bottlePreference (sample/partial/full). */
export const scoreBottlePreferenceFit = (
  preference: "sample" | "partial" | "full" | "any" | null | undefined,
  listing: {
    available?: string | null
    decantFormat?: "atomizer" | "vial" | "original" | null
    mlRemaining?: number | null
  }
): number => {
  if (!preference || preference === "any") return 0
  const ml =
    listing.mlRemaining ??
    (listing.available ? Number.parseFloat(listing.available) : NaN)
  const isDecant =
    listing.decantFormat === "atomizer" || listing.decantFormat === "vial"
  const isOriginal = listing.decantFormat === "original" || listing.decantFormat == null

  if (preference === "sample") {
    if (isDecant) return 3
    if (Number.isFinite(ml) && ml > 0 && ml <= 5) return 2
    return 0
  }
  if (preference === "partial") {
    if (isDecant) return 2
    if (Number.isFinite(ml) && ml > 5 && ml < 50) return 3
    if (Number.isFinite(ml) && ml >= 50) return 1
    return 1
  }
  // full bottle
  if (isOriginal && (!Number.isFinite(ml) || ml >= 30)) return 3
  if (!isDecant) return 2
  return 0
}

const sortListingsByScentProfile = <T extends RankableListing>(
  listings: T[],
  perfumeHouseType: string | null | undefined,
  signals: ReturnType<typeof signalsFromScentProfileFields>,
  bottlePreference?: "sample" | "partial" | "full" | "any" | null
): T[] =>
  [...listings].sort((a, b) => {
    const bottleDelta =
      scoreBottlePreferenceFit(bottlePreference, b) -
      scoreBottlePreferenceFit(bottlePreference, a)
    if (bottleDelta !== 0) return bottleDelta
    return (
      scoreListingPreferenceAlignment(
        { price: b.price, type: b.type, perfumeHouseType },
        signals
      ) -
      scoreListingPreferenceAlignment(
        { price: a.price, type: a.type, perfumeHouseType },
        signals
      )
    )
  })

const bestListingAlignmentScore = (
  listings: RankableListing[],
  perfumeHouseType: string | null | undefined,
  signals: ReturnType<typeof signalsFromScentProfileFields>,
  bottlePreference?: "sample" | "partial" | "full" | "any" | null
): number => {
  if (listings.length === 0) return 0
  return Math.max(
    ...listings.map(
      l =>
        scoreListingPreferenceAlignment(
          {
            price: l.price,
            type: l.type,
            perfumeHouseType,
          },
          signals
        ) + scoreBottlePreferenceFit(bottlePreference, l)
    )
  )
}

/**
 * Listings on the exchange for perfumes on the viewer's wishlist (IMP-140).
 */
export const getWishlistExchangeMatches = async (
  viewerId: string,
  limit = WISHLIST_EXCHANGE_MATCH_LIMIT
): Promise<WishlistExchangeMatchRow[]> => {
  const profile = await getOrCreateScentProfile(viewerId)
  const preferenceSignals = signalsFromScentProfileFields(profile)

  const wishlistRows = await prisma.userPerfumeWishlist.findMany({
    where: { userId: viewerId },
    select: { perfumeId: true, bottlePreference: true },
  })
  const perfumeIds = [...new Set(wishlistRows.map(row => row.perfumeId))]
  if (perfumeIds.length === 0) return []

  const preferenceByPerfumeId = new Map(
    wishlistRows.map(row => [row.perfumeId, row.bottlePreference] as const)
  )

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
    take: limit * 3,
  })

  return perfumes
    .filter(p => p.userPerfume.length > 0)
    .map(p => ({
      ...p,
      userPerfume: sortListingsByScentProfile(
        p.userPerfume,
        p.perfumeHouse?.type,
        preferenceSignals,
        preferenceByPerfumeId.get(p.id)
      ),
    }))
    .sort(
      (a, b) =>
        bestListingAlignmentScore(
          b.userPerfume,
          b.perfumeHouse?.type,
          preferenceSignals,
          preferenceByPerfumeId.get(b.id)
        ) -
          bestListingAlignmentScore(
            a.userPerfume,
            a.perfumeHouse?.type,
            preferenceSignals,
            preferenceByPerfumeId.get(a.id)
          ) || a.name.localeCompare(b.name)
    )
    .slice(0, limit)
}

/**
 * Traders whose public wishlist includes a perfume the user has listed (IMP-141).
 */
export const getTradersWantingUserListings = async (
  userId: string,
  limit = TRADERS_WANTING_LISTINGS_LIMIT
): Promise<TraderWantingUserListingRow[]> => {
  const profile = await getOrCreateScentProfile(userId)
  const preferenceSignals = signalsFromScentProfileFields(profile)

  const listed = await prisma.userPerfume.findMany({
    where: {
      userId,
      available: { not: "0" },
    },
    select: {
      perfumeId: true,
      price: true,
      type: true,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          perfumeHouse: { select: { type: true } },
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

  const listingByPerfumeId = new Map(
    listed.map(row => [
      row.perfumeId,
      {
        price: row.price,
        type: row.type,
        houseType: row.perfume.perfumeHouse?.type,
      },
    ])
  )

  const byTrader = new Map<string, TraderWantingUserListingRow & { _score: number }>()

  for (const hit of wishlistHits) {
    const listing = listingByPerfumeId.get(hit.perfume.id)
    const hitScore = listing
      ? scoreListingPreferenceAlignment(
          {
            price: listing.price,
            type: listing.type,
            perfumeHouseType: listing.houseType,
          },
          preferenceSignals
        )
      : 0

    const existing = byTrader.get(hit.userId)
    if (existing) {
      if (!existing.perfumes.some(p => p.id === hit.perfume.id)) {
        existing.perfumes.push(hit.perfume)
      }
      existing._score = Math.max(existing._score, hitScore)
      continue
    }
    if (byTrader.size >= limit * 2) continue
    byTrader.set(hit.userId, {
      trader: hit.user,
      perfumes: [hit.perfume],
      _score: hitScore,
    })
  }

  return [...byTrader.values()]
    .sort((a, b) => b._score - a._score || a.trader.id.localeCompare(b.trader.id))
    .slice(0, limit)
    .map(({ trader, perfumes }) => ({ trader, perfumes }))
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
