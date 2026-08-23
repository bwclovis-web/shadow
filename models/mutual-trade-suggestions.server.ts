import { prisma } from "@/lib/db"
import { getTraderDisplayName } from "@/utils/user"

export type MutualTradeSuggestion = {
  traderId: string
  traderDisplayName: string
  /** Perfume you want from them (on your wishlist, they list it). */
  youWant: {
    perfumeId: string
    perfumeName: string
    perfumeSlug: string
    perfumeImage: string | null
    listingId: string
    available: string
  }
  /** Perfume they want from you (on their wishlist, you list it). */
  theyWant: {
    perfumeId: string
    perfumeName: string
    perfumeSlug: string
    perfumeImage: string | null
    listingId: string
    available: string
  }
}

/**
 * Detect mutual swap pairs: viewer wants A from trader T, T wants B from viewer.
 */
export const getMutualTradeSuggestions = async (
  viewerId: string,
  limit = 6
): Promise<MutualTradeSuggestion[]> => {
  const [viewerWishlist, viewerListings] = await Promise.all([
    prisma.userPerfumeWishlist.findMany({
      where: { userId: viewerId },
      select: { perfumeId: true },
    }),
    prisma.userPerfume.findMany({
      where: { userId: viewerId, available: { not: "0" } },
      select: {
        id: true,
        perfumeId: true,
        available: true,
        perfume: {
          select: { id: true, name: true, slug: true, image: true },
        },
      },
    }),
  ])

  const wantIds = viewerWishlist.map(w => w.perfumeId)
  const offerIds = viewerListings.map(l => l.perfumeId)
  if (wantIds.length === 0 || offerIds.length === 0) return []

  const theirListingsOfMyWants = await prisma.userPerfume.findMany({
    where: {
      perfumeId: { in: wantIds },
      userId: { not: viewerId },
      available: { not: "0" },
    },
    select: {
      id: true,
      userId: true,
      available: true,
      perfume: {
        select: { id: true, name: true, slug: true, image: true },
      },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      },
    },
    take: 80,
  })

  const candidateTraderIds = [...new Set(theirListingsOfMyWants.map(l => l.userId))]
  if (candidateTraderIds.length === 0) return []

  const theirWishlists = await prisma.userPerfumeWishlist.findMany({
    where: {
      userId: { in: candidateTraderIds },
      perfumeId: { in: offerIds },
      isPublic: true,
    },
    select: {
      userId: true,
      perfumeId: true,
    },
  })

  const traderWantsFromMe = new Map<string, Set<string>>()
  for (const row of theirWishlists) {
    const set = traderWantsFromMe.get(row.userId) ?? new Set()
    set.add(row.perfumeId)
    traderWantsFromMe.set(row.userId, set)
  }

  const listingByPerfume = new Map(
    viewerListings.map(l => [l.perfumeId, l] as const)
  )

  const suggestions: MutualTradeSuggestion[] = []
  const seenTraders = new Set<string>()

  for (const listing of theirListingsOfMyWants) {
    if (seenTraders.has(listing.userId)) continue
    const wants = traderWantsFromMe.get(listing.userId)
    if (!wants || wants.size === 0) continue

    const theyWantPerfumeId = [...wants][0]!
    const myListing = listingByPerfume.get(theyWantPerfumeId)
    if (!myListing) continue

    seenTraders.add(listing.userId)
    suggestions.push({
      traderId: listing.userId,
      traderDisplayName: getTraderDisplayName(listing.user),
      youWant: {
        perfumeId: listing.perfume.id,
        perfumeName: listing.perfume.name,
        perfumeSlug: listing.perfume.slug,
        perfumeImage: listing.perfume.image,
        listingId: listing.id,
        available: listing.available,
      },
      theyWant: {
        perfumeId: myListing.perfume.id,
        perfumeName: myListing.perfume.name,
        perfumeSlug: myListing.perfume.slug,
        perfumeImage: myListing.perfume.image,
        listingId: myListing.id,
        available: myListing.available,
      },
    })
    if (suggestions.length >= limit) break
  }

  return suggestions
}
