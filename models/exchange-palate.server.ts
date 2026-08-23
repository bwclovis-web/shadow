import { prisma } from "@/lib/db"
import { getPersonalizedRecommendations } from "@/services/recommendations"
import {
  enrichOnboardingMatches,
  type OnboardingTraderMatchEnriched,
} from "@/services/trade-match"
import { loadTraderReputationsForUserIds } from "@/services/reputation/loadReputationInputs.server"
import { getTraderDisplayName } from "@/utils/user"
import type { OnboardingTraderMatch } from "@/models/onboarding.server"

const traderUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
} as const

/**
 * Exchange listings for perfumes recommended by scent profile / quiz —
 * not necessarily on the viewer's wishlist (Phase 3.1).
 */
export const getExchangePalateRecommendations = async (
  viewerId: string,
  limit = 8
): Promise<OnboardingTraderMatchEnriched[]> => {
  const [recommendations, wishlistRows] = await Promise.all([
    getPersonalizedRecommendations(viewerId, limit * 3),
    prisma.userPerfumeWishlist.findMany({
      where: { userId: viewerId },
      select: { perfumeId: true },
    }),
  ])

  const wishlistPerfumeIds = new Set(wishlistRows.map(r => r.perfumeId))
  const perfumeIds = recommendations
    .map(p => p.id)
    .filter(id => !wishlistPerfumeIds.has(id))

  if (perfumeIds.length === 0) return []

  const listings = await prisma.userPerfume.findMany({
    where: {
      perfumeId: { in: perfumeIds },
      userId: { not: viewerId },
      available: { not: "0" },
    },
    select: {
      id: true,
      userId: true,
      available: true,
      tradePreference: true,
      tradeOnly: true,
      tradePrice: true,
      price: true,
      images: true,
      condition: true,
      decantFormat: true,
      mlRemaining: true,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          perfumeHouse: { select: { name: true } },
        },
      },
      user: { select: traderUserSelect },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 4,
  })

  const orderIndex = new Map(perfumeIds.map((id, i) => [id, i]))
  listings.sort(
    (a, b) =>
      (orderIndex.get(a.perfume.id) ?? 99) - (orderIndex.get(b.perfume.id) ?? 99)
  )

  const raw: OnboardingTraderMatch[] = []
  const seenPerfumes = new Set<string>()
  for (const listing of listings) {
    if (seenPerfumes.has(listing.perfume.id)) continue
    seenPerfumes.add(listing.perfume.id)
    raw.push({
      userPerfumeId: listing.id,
      perfumeId: listing.perfume.id,
      perfumeName: listing.perfume.name,
      perfumeSlug: listing.perfume.slug,
      perfumeImage: listing.perfume.image,
      perfumeHouse: listing.perfume.perfumeHouse?.name,
      counterpartyId: listing.userId,
      counterpartyDisplayName: getTraderDisplayName(listing.user),
      available: listing.available,
      tradePreference: listing.tradePreference,
      tradeOnly: listing.tradeOnly,
      tradePrice: listing.tradePrice,
      price: listing.price,
      images: listing.images ?? [],
      condition: listing.condition,
      decantFormat: listing.decantFormat,
      mlRemaining: listing.mlRemaining,
      source: "scentProfile",
    })
    if (raw.length >= limit) break
  }

  if (raw.length === 0) return []

  const reputationMap = await loadTraderReputationsForUserIds(
    raw.map(r => r.counterpartyId)
  )
  return enrichOnboardingMatches(viewerId, raw, Object.fromEntries(reputationMap))
}
