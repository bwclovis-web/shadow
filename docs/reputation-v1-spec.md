# Trader reputation — canonical rules (v1.0)

**Version:** 1.0  
**Tables:** `TraderFeedback`, `TraderContactMessage`, `Trade`, `TradeEvent`  
**Implementation:** [`services/reputation/`](../services/reputation/)

This document is the single source of truth for thresholds. Code constants must match.

## Messaging heuristic (first reply)

For each **conversation partner** U who has messaged trader T:

1. Consider all messages between T and U in chronological order.
2. Find the **first** message whose `recipientId === T` (inbound to the trader).
3. Find the **first** message **after** that whose `senderId === T` and `recipientId === U` (trader’s reply).
4. Record **hours** from inbound `createdAt` to reply `createdAt`.

Pairs with no inbound or no reply are **skipped** (no penalty).

**Last 10 threads (IMP-121):** Sort partners by most recent inbound `createdAt` (desc), keep at most 10, then take the **median** first-reply hours over those intervals only.  
**Sample count** = number of intervals in that window.

**Limitation:** There is no thread id; each partner is one “thread.” Copy must say scores use contact message timing where applicable.

## Trade reliability (IMP-123)

- `completedCount` = trades with `status === completed` where the trader is initiator or counterparty.
- `cancelledByTrader` = trades with `status === cancelled` and a `TradeEvent` with `type === cancelled` and `actorUserId === trader`.
- `tradeReliabilityPercent = round(100 * completed / (completed + cancelledByTrader))` when denominator > 0; else null.
- Declined trades are **not** included.

## Reputation score (0–100)

- Shown only if `totalReviews >= 3` (`MIN_REVIEWS_FOR_SCORE`). Otherwise `score` is null and UI shows “not enough reviews”.
- **Feedback component:** `raw = (averageRating - 1) / 4 * 100`, then `feedbackScore = raw * (0.5 + 0.5 * min(1, totalReviews / 10))`.
- **Response component** (only if `replySampleCount >= 3` and median hours is defined):  
  piecewise from median hours: ≤6→100, ≤12→95, ≤24→85, ≤48→70, ≤72→50, else→35.
- **Blend:** If response component applies:  
  `score = round(min(100, 0.75 * feedbackScore + 0.25 * responseScore))`.  
  If not: `score = round(min(100, feedbackScore))`.

## Badges (independent)

| Badge ID | Rules |
|----------|--------|
| `topReviewed` | `totalReviews >= 5` and `averageRating >= 4.5` |
| `reliableTrader` | `totalReviews >= 10` and `averageRating >= 4.6` |
| `fastResponder` | `replySampleCount >= 3` and median `<= 24` hours (last 10 partners) |

Badges are not mutually exclusive.

## Feedback gating (IMP-122)

When `TRADER_FEEDBACK_REQUIRES_COMPLETED_TRADE` is not `"false"` (default: required):

- Reviewer must share at least one `completed` trade with the trader.
- Submitted feedback stores `tradeId` (explicit or most recent completed trade).

## API / DTO

Public payloads must not include message bodies. Include aggregates: median hours, sample count, score, badges, review average, review count, `completedTradeCount`, `tradeReliabilityPercent`, `canLeaveFeedback`, `eligibleTradeId`.

## Contributor badges (C2)

Separate from reputation v1 badges. See [contributor-badges-spec.md](./contributor-badges-spec.md). Profile payloads also include `contributorBadges`.
