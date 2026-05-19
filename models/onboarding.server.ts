import { prisma } from "@/lib/db"
import { getWishlistExchangeMatches } from "@/models/wishlist-matching.server"
import { getPersonalizedRecommendations } from "@/services/recommendations"
import { loadTraderReputationsForUserIds } from "@/services/reputation/loadReputationInputs.server"
import {
  enrichOnboardingMatches,
  type OnboardingTraderMatchEnriched,
} from "@/services/trade-match"
import { getProfileSlug, getTraderDisplayName } from "@/utils/user"

const ONBOARDING_MATCH_LIMIT = 3

export type OnboardingStepId = "quiz" | "bottle" | "matches"

export type OnboardingTraderMatch = {
  userPerfumeId: string
  perfumeId: string
  perfumeName: string
  perfumeSlug: string
  perfumeImage: string | null
  perfumeHouse?: string
  counterpartyId: string
  counterpartyDisplayName: string
  available: string
  tradePreference: string | null
  tradeOnly: boolean
  tradePrice: string | null
  price: string | null
  images: string[]
  condition: "sealed" | "mint" | "lightlyUsed" | "heavilyUsed" | "damaged" | null
  decantFormat: "atomizer" | "vial" | "original" | null
  mlRemaining: number | null
  source: "wishlist" | "scentProfile"
}

export type OnboardingSteps = {
  quiz: boolean
  bottle: boolean
  matches: boolean
}

export type OnboardingState = {
  showBanner: boolean
  steps: OnboardingSteps
  activeStep: OnboardingStepId
  profileSlug: string
  matches: OnboardingTraderMatchEnriched[]
}

const traderUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
} as const

const flattenWishlistMatches = (
  viewerId: string,
  limit: number
): Promise<OnboardingTraderMatch[]> =>
  getWishlistExchangeMatches(viewerId, limit * 4).then(rows => {
    const out: OnboardingTraderMatch[] = []
    for (const perfume of rows) {
      for (const listing of perfume.userPerfume) {
        if (listing.userId === viewerId) continue
        out.push({
          userPerfumeId: listing.id,
          perfumeId: perfume.id,
          perfumeName: perfume.name,
          perfumeSlug: perfume.slug,
          perfumeImage: perfume.image,
          perfumeHouse: perfume.perfumeHouse?.name,
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
          source: "wishlist",
        })
        if (out.length >= limit) return out
      }
    }
    return out
  })

const fetchScentProfileExchangeMatches = async (
  viewerId: string,
  limit: number,
  excludeListingIds: Set<string>
): Promise<OnboardingTraderMatch[]> => {
  if (limit <= 0) return []

  const recommendations = await getPersonalizedRecommendations(viewerId, limit * 3)
  const perfumeIds = recommendations.map(p => p.id)
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

  const out: OnboardingTraderMatch[] = []
  for (const listing of listings) {
    if (excludeListingIds.has(listing.id)) continue
    out.push({
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
    if (out.length >= limit) break
  }
  return out
}

/** Top exchange listings from wishlist + scent profile overlap (IMP-203). */
export const getOnboardingTraderMatches = async (
  viewerId: string,
  limit = ONBOARDING_MATCH_LIMIT
): Promise<OnboardingTraderMatch[]> => {
  const wishlistMatches = await flattenWishlistMatches(viewerId, limit)
  if (wishlistMatches.length >= limit) return wishlistMatches

  const seen = new Set(wishlistMatches.map(m => m.userPerfumeId))
  const profileMatches = await fetchScentProfileExchangeMatches(
    viewerId,
    limit - wishlistMatches.length,
    seen
  )
  return [...wishlistMatches, ...profileMatches]
}

const getStepCompletion = async (userId: string): Promise<OnboardingSteps> => {
  const [profile, bottleCount, user] = await Promise.all([
    prisma.scentProfile.findUnique({
      where: { userId },
      select: { lastQuizAt: true },
    }),
    prisma.userPerfume.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingMatchesViewedAt: true },
    }),
  ])

  return {
    quiz: profile?.lastQuizAt != null,
    bottle: bottleCount > 0,
    matches: user?.onboardingMatchesViewedAt != null,
  }
}

const getActiveStep = (steps: OnboardingSteps): OnboardingStepId => {
  if (!steps.quiz) return "quiz"
  if (!steps.bottle) return "bottle"
  return "matches"
}

/** When all steps are done, persist onboardingCompletedAt (IMP-204). */
export const syncOnboardingCompletion = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingCompletedAt: true },
  })
  if (user?.onboardingCompletedAt) return

  const steps = await getStepCompletion(userId)
  if (steps.quiz && steps.bottle && steps.matches) {
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    })
  }
}

export const dismissOnboarding = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: new Date() },
  })
}

export const markOnboardingMatchesViewed = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingMatchesViewedAt: new Date() },
  })
}

export const completeOnboarding = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: new Date() },
  })
}

export const getOnboardingState = async (
  userId: string
): Promise<OnboardingState | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingCompletedAt: true,
      profileSlug: true,
      username: true,
    },
  })
  if (!user || user.onboardingCompletedAt) return null

  const steps = await getStepCompletion(userId)
  const profileSlug = getProfileSlug({
    id: userId,
    username: user.username,
    profileSlug: user.profileSlug,
  })

  const rawMatches =
    steps.quiz && steps.bottle ? await getOnboardingTraderMatches(userId) : []

  const counterpartyIds = rawMatches.map(m => m.counterpartyId)
  const reputationMap =
    counterpartyIds.length > 0
      ? await loadTraderReputationsForUserIds(counterpartyIds)
      : new Map()
  const matches = await enrichOnboardingMatches(
    userId,
    rawMatches,
    Object.fromEntries(reputationMap)
  )

  return {
    showBanner: true,
    steps,
    activeStep: getActiveStep(steps),
    profileSlug,
    matches,
  }
}
