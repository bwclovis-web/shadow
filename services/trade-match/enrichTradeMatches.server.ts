import { prisma } from "@/lib/db"
import type { OnboardingTraderMatch } from "@/models/onboarding.server"
import type {
  TraderWantingUserListingRow,
  WishlistExchangeMatchRow,
} from "@/models/wishlist-matching.server"
import type { TraderReputationV1 } from "@/services/reputation/types"

import { computeTradeMatchReasons } from "./computeTradeMatchReasons"
import { loadTopNoteFamiliesByUserIds } from "./loadTopFamilies.server"
import type {
  TradeMatchExplanation,
  TradeMatchSurface,
  TradeMatchUserContext,
} from "./types"

export type TradeMatchBatchContext = {
  viewer: TradeMatchUserContext
  counterpartyById: Map<string, TradeMatchUserContext>
}

const emptyUserContext = (): TradeMatchUserContext => ({
  region: null,
  topFamilies: [],
})

const reputationToInput = (rep: TraderReputationV1 | undefined) => {
  if (!rep) return null
  return {
    score: rep.score,
    badges: rep.badges,
    tradeReliabilityPercent: rep.tradeReliabilityPercent,
    completedTradeCount: rep.completedTradeCount,
  }
}

const buildUserContext = (
  userId: string,
  regions: Map<string, string | null>,
  families: Map<string, import("@/utils/scent-dna/note-families").NoteFamilyId[]>
): TradeMatchUserContext => ({
  region: regions.get(userId) ?? null,
  topFamilies: families.get(userId) ?? [],
})

/**
 * Batch-load viewer + counterparty region and Scent DNA families.
 */
export const loadTradeMatchBatchContext = async (
  viewerId: string,
  counterpartyIds: string[]
): Promise<TradeMatchBatchContext> => {
  const ids = [...new Set([viewerId, ...counterpartyIds.filter(Boolean)])]
  const [users, families] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, region: true },
    }),
    loadTopNoteFamiliesByUserIds(ids),
  ])

  const regions = new Map(users.map(u => [u.id, u.region]))
  const counterpartyById = new Map<string, TradeMatchUserContext>()

  for (const id of counterpartyIds) {
    if (!id || id === viewerId) continue
    counterpartyById.set(
      id,
      buildUserContext(id, regions, families)
    )
  }

  return {
    viewer: buildUserContext(viewerId, regions, families),
    counterpartyById,
  }
}

const explainForCounterparty = (
  surface: TradeMatchSurface,
  ctx: TradeMatchBatchContext,
  counterpartyId: string,
  options: {
    wishlistOverlapCount?: number
    reputation?: TraderReputationV1
    hasSimilarTrade?: boolean
  } = {}
): TradeMatchExplanation => {
  const counterparty =
    ctx.counterpartyById.get(counterpartyId) ?? emptyUserContext()

  return computeTradeMatchReasons({
    surface,
    viewer: ctx.viewer,
    counterparty,
    wishlistOverlapCount: options.wishlistOverlapCount,
    reputation: reputationToInput(options.reputation),
    hasSimilarTrade: options.hasSimilarTrade,
  })
}

export type WishlistExchangeMatchEnriched = WishlistExchangeMatchRow & {
  matchExplanation: TradeMatchExplanation
  /** Per listing id — for multi-trader perfume picker */
  listingMatchExplanations: Record<string, TradeMatchExplanation>
}

/**
 * Attach best-listing match explanation per wishlist exchange perfume row.
 */
export const enrichWishlistExchangeMatches = async (
  viewerId: string,
  matches: WishlistExchangeMatchRow[],
  reputationByUserId: Record<string, TraderReputationV1> = {}
): Promise<WishlistExchangeMatchEnriched[]> => {
  if (matches.length === 0) return []

  const counterpartyIds = matches.flatMap(p =>
    p.userPerfume.map(up => up.userId)
  )
  const ctx = await loadTradeMatchBatchContext(viewerId, counterpartyIds)

  return matches.map(perfume => {
    let best: TradeMatchExplanation | null = null
    const listingMatchExplanations: Record<string, TradeMatchExplanation> = {}

    for (const listing of perfume.userPerfume) {
      if (listing.userId === viewerId) continue
      const explanation = explainForCounterparty(
        "matches_for_you",
        ctx,
        listing.userId,
        { reputation: reputationByUserId[listing.userId] }
      )
      listingMatchExplanations[listing.id] = explanation
      if (!best || explanation.sortScore > best.sortScore) {
        best = explanation
      }
    }

    return {
      ...perfume,
      listingMatchExplanations,
      matchExplanation:
        best ??
        computeTradeMatchReasons({
          surface: "matches_for_you",
          viewer: ctx.viewer,
          counterparty: emptyUserContext(),
        }),
    }
  })
}

export type TraderWantingUserListingEnriched = TraderWantingUserListingRow & {
  matchExplanation: TradeMatchExplanation
}

export const enrichWishlistDemandRows = async (
  viewerId: string,
  rows: TraderWantingUserListingRow[],
  reputationByUserId: Record<string, TraderReputationV1> = {}
): Promise<TraderWantingUserListingEnriched[]> => {
  if (rows.length === 0) return []

  const counterpartyIds = rows.map(r => r.trader.id)
  const ctx = await loadTradeMatchBatchContext(viewerId, counterpartyIds)

  return rows.map(row => ({
    ...row,
    matchExplanation: explainForCounterparty(
      "wishlist_demand",
      ctx,
      row.trader.id,
      {
        wishlistOverlapCount: row.perfumes.length,
        reputation: reputationByUserId[row.trader.id],
      }
    ),
  }))
}

export type OnboardingTraderMatchEnriched = OnboardingTraderMatch & {
  matchExplanation: TradeMatchExplanation
}

export const enrichOnboardingMatches = async (
  viewerId: string,
  matches: OnboardingTraderMatch[],
  reputationByUserId: Record<string, TraderReputationV1> = {}
): Promise<OnboardingTraderMatchEnriched[]> => {
  if (matches.length === 0) return []

  const counterpartyIds = matches.map(m => m.counterpartyId)
  const ctx = await loadTradeMatchBatchContext(viewerId, counterpartyIds)

  return matches.map(match => {
    const surface: TradeMatchSurface =
      match.source === "wishlist" ? "onboarding_wishlist" : "onboarding_scent_profile"

    return {
      ...match,
      matchExplanation: explainForCounterparty(surface, ctx, match.counterpartyId, {
        reputation: reputationByUserId[match.counterpartyId],
      }),
    }
  })
}
