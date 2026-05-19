# Trade Match Score v1 (D2)

Explainable “why this swap fits” copy on trade-discovery surfaces. No numeric match percentage in the UI; internal `sortScore` is used only for ordering when multiple listings compete.

**Version:** `1.0` (`TRADE_MATCH_V1_VERSION`)

## Surfaces

| Surface | `TradeMatchSurface` | Base reason |
|---------|---------------------|-------------|
| Exchange — Matches for you | `matches_for_you` | `on_your_wishlist` |
| My Scents — Someone wants what you have | `wishlist_demand` | `they_want_yours` or `wishlist_overlap_depth` (≥2 perfumes) |
| Onboarding matches (wishlist source) | `onboarding_wishlist` | `on_your_wishlist` |
| Onboarding matches (scent profile source) | `onboarding_scent_profile` | (secondary reasons only unless DNA overlaps) |
| Exchange listing picker | `listing_picker` / per-listing map | `on_your_wishlist` |

## Reason kinds and thresholds

| Kind | Condition |
|------|-----------|
| `on_your_wishlist` | Wishlist match surfaces |
| `they_want_yours` | Demand row, single perfume overlap |
| `wishlist_overlap_depth` | Demand row, `{count}` ≥ 2 |
| `scent_dna_overlap` | Shared top note families (viewer ∩ counterparty, up to 3 labels) |
| `same_region` | Both users resolve to the same `ExchangeRegionBucket` via `resolveExchangeRegionBucket` |
| `top_rated_swapper` | `reputation.score` ≥ 80 **or** `topReviewed` badge |
| `fast_responder` | `fastResponder` badge |
| `reliable_swapper` | `tradeReliabilityPercent` ≥ 85 and `completedTradeCount` > 0 |
| `similar_trade_history` | **Deferred (D2.1)** — not shipped in v1 |

Constants: [`services/trade-match/v1-constants.ts`](../services/trade-match/v1-constants.ts)

## Display rules

- Inline: up to **2** reasons (`TRADE_MATCH_INLINE_REASON_LIMIT`), film noir chips (`border-noir-gold/20`, `bg-noir-black/40`).
- Additional reasons: info popover (same pattern as `RecommendationReasonLine`).
- i18n: `tradingPost.matchReason.*`, `myScents.wishlistDemand.matchReason.*`; family names reuse `traderProfile.scentDna.families`.

## Implementation

- Pure compute: [`services/trade-match/computeTradeMatchReasons.ts`](../services/trade-match/computeTradeMatchReasons.ts)
- Batch enrichment: [`services/trade-match/enrichTradeMatches.server.ts`](../services/trade-match/enrichTradeMatches.server.ts)
- Region normalization: [`utils/region-bucket.ts`](../utils/region-bucket.ts)
- UI: [`components/Molecules/TradeMatchReasonLine`](../components/Molecules/TradeMatchReasonLine/TradeMatchReasonLine.tsx)

## D2.1 (not in v1)

- `similar_trade_history`: batched query on completed trades + `TradeLineItem.perfumeId` for counterparty IDs on the page.
- Optional numeric badge only if every point maps to visible copy.
