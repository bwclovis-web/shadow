/**
 * Trade Match Score v1 — keep in sync with docs/trade-match-score-v1.md
 */

export const TRADE_MATCH_V1_VERSION = "1.0" as const

/** Max reasons shown inline on a card */
export const TRADE_MATCH_INLINE_REASON_LIMIT = 2

/** Reputation score at or above this → top_rated_swapper */
export const TOP_RATED_SWAPPER_MIN_SCORE = 80

/** Trade reliability % at or above this → reliable_swapper */
export const RELIABLE_SWAPPER_MIN_PERCENT = 85

/** Minimum overlap perfumes on demand row for wishlist_overlap_depth */
export const WISHLIST_OVERLAP_DEPTH_MIN = 2

/** Internal sort weights (higher = stronger signal) */
export const SORT_WEIGHT: Record<string, number> = {
  on_your_wishlist: 100,
  they_want_yours: 100,
  wishlist_overlap_depth: 95,
  scent_dna_overlap: 70,
  same_region: 50,
  top_rated_swapper: 40,
  fast_responder: 35,
  reliable_swapper: 30,
  similar_trade_history: 25,
}
