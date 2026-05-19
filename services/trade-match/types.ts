import type { NoteFamilyId } from "@/utils/scent-dna/note-families"

import type { TRADE_MATCH_V1_VERSION } from "./v1-constants"

export type TradeMatchSurface =
  | "matches_for_you"
  | "wishlist_demand"
  | "onboarding_wishlist"
  | "onboarding_scent_profile"
  | "listing_picker"

export type TradeMatchReason =
  | { kind: "on_your_wishlist" }
  | { kind: "they_want_yours" }
  | { kind: "wishlist_overlap_depth"; count: number }
  | { kind: "scent_dna_overlap"; families: NoteFamilyId[] }
  | { kind: "same_region" }
  | { kind: "top_rated_swapper" }
  | { kind: "fast_responder" }
  | { kind: "reliable_swapper" }
  | { kind: "similar_trade_history" }

export type TradeMatchUserContext = {
  region: string | null
  topFamilies: NoteFamilyId[]
}

export type TradeMatchComputeInput = {
  surface: TradeMatchSurface
  viewer: TradeMatchUserContext
  counterparty: TradeMatchUserContext
  wishlistOverlapCount?: number
  perfumeId?: string
  hasSimilarTrade?: boolean
  reputation?: {
    score: number | null
    badges: ReadonlyArray<string>
    tradeReliabilityPercent: number | null
    completedTradeCount: number
  } | null
}

export type TradeMatchExplanation = {
  version: typeof TRADE_MATCH_V1_VERSION
  reasons: TradeMatchReason[]
  /** Top N for inline chips */
  primaryReasons: TradeMatchReason[]
  sortScore: number
}
