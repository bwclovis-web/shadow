import type { NoteFamilyId } from "@/utils/scent-dna/note-families"
import { regionsShareExchangeBucket } from "@/utils/region-bucket"

import type {
  TradeMatchComputeInput,
  TradeMatchExplanation,
  TradeMatchReason,
} from "./types"
import {
  RELIABLE_SWAPPER_MIN_PERCENT,
  SORT_WEIGHT,
  TOP_RATED_SWAPPER_MIN_SCORE,
  TRADE_MATCH_INLINE_REASON_LIMIT,
  TRADE_MATCH_V1_VERSION,
  WISHLIST_OVERLAP_DEPTH_MIN,
} from "./v1-constants"

const REASON_PRIORITY: TradeMatchReason["kind"][] = [
  "on_your_wishlist",
  "they_want_yours",
  "wishlist_overlap_depth",
  "scent_dna_overlap",
  "same_region",
  "top_rated_swapper",
  "fast_responder",
  "reliable_swapper",
  "similar_trade_history",
]

const intersectFamilies = (
  a: NoteFamilyId[],
  b: NoteFamilyId[]
): NoteFamilyId[] => {
  const setB = new Set(b)
  return a.filter(f => setB.has(f))
}

const sortReasonsByPriority = (reasons: TradeMatchReason[]): TradeMatchReason[] => {
  const rank = new Map(REASON_PRIORITY.map((k, i) => [k, i]))
  return [...reasons].sort(
    (a, b) => (rank.get(a.kind) ?? 99) - (rank.get(b.kind) ?? 99)
  )
}

const computeSortScore = (reasons: TradeMatchReason[]): number =>
  reasons.reduce((sum, r) => sum + (SORT_WEIGHT[r.kind] ?? 0), 0)

/**
 * Pure v1 trade-match explanations from viewer + counterparty context.
 */
export const computeTradeMatchReasons = (
  input: TradeMatchComputeInput
): TradeMatchExplanation => {
  const reasons: TradeMatchReason[] = []
  const { surface, viewer, counterparty, reputation } = input

  if (surface === "matches_for_you" || surface === "listing_picker") {
    reasons.push({ kind: "on_your_wishlist" })
  }

  if (surface === "wishlist_demand") {
    const count = input.wishlistOverlapCount ?? 0
    if (count >= WISHLIST_OVERLAP_DEPTH_MIN) {
      reasons.push({ kind: "wishlist_overlap_depth", count })
    } else {
      reasons.push({ kind: "they_want_yours" })
    }
  }

  if (surface === "onboarding_wishlist") {
    reasons.push({ kind: "on_your_wishlist" })
  }

  const sharedFamilies = intersectFamilies(
    viewer.topFamilies,
    counterparty.topFamilies
  )
  if (sharedFamilies.length > 0) {
    reasons.push({ kind: "scent_dna_overlap", families: sharedFamilies.slice(0, 3) })
  }

  if (regionsShareExchangeBucket(viewer.region, counterparty.region)) {
    reasons.push({ kind: "same_region" })
  }

  if (reputation) {
    const hasTopReviewed = reputation.badges.includes("topReviewed")
    if (
      hasTopReviewed ||
      (reputation.score != null && reputation.score >= TOP_RATED_SWAPPER_MIN_SCORE)
    ) {
      reasons.push({ kind: "top_rated_swapper" })
    }
    if (reputation.badges.includes("fastResponder")) {
      reasons.push({ kind: "fast_responder" })
    }
    if (
      reputation.tradeReliabilityPercent != null &&
      reputation.tradeReliabilityPercent >= RELIABLE_SWAPPER_MIN_PERCENT &&
      reputation.completedTradeCount > 0
    ) {
      reasons.push({ kind: "reliable_swapper" })
    }
  }

  if (input.hasSimilarTrade) {
    reasons.push({ kind: "similar_trade_history" })
  }

  const sorted = sortReasonsByPriority(reasons)
  const primaryReasons = sorted.slice(0, TRADE_MATCH_INLINE_REASON_LIMIT)

  return {
    version: TRADE_MATCH_V1_VERSION,
    reasons: sorted,
    primaryReasons,
    sortScore: computeSortScore(sorted),
  }
}
