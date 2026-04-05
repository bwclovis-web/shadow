# Trader reputation — canonical rules (v1.0)

**Version:** 1.0  
**Tables:** `TraderFeedback`, `TraderContactMessage`  
**Implementation:** [`services/reputation/`](../services/reputation/)

This document is the single source of truth for thresholds. Code constants must match.

## Messaging heuristic (first reply)

For each **other user** U who has messaged trader T:

1. Consider all messages between T and U in chronological order.
2. Find the **first** message whose `recipientId === T` (inbound to the trader).
3. Find the **first** message **after** that whose `senderId === T` and `recipientId === U` (trader’s reply).
4. Record **hours** from inbound `createdAt` to reply `createdAt`.

Pairs with no inbound or no reply are **skipped** (no penalty).  
**Median** first-reply hours is taken over all recorded intervals.  
**Sample count** = number of intervals.

**Limitation:** There is no thread id; cross-conversation noise is possible. Copy must say scores use contact message timing where applicable.

## Reputation score (0–100)

- Shown only if `totalReviews >= 3` (`MIN_REVIEWS_FOR_SCORE`). Otherwise `score` is null and UI shows “not enough reviews”.
- **Feedback component:** `raw = (averageRating - 1) / 4 * 100`, then `feedbackScore = raw * (0.5 + 0.5 * min(1, totalReviews / 10))`.
- **Response component** (only if `replySampleCount >= 5` and median hours is defined):  
  piecewise from median hours: ≤6→100, ≤12→95, ≤24→85, ≤48→70, ≤72→50, else→35.
- **Blend:** If response component applies:  
  `score = round(min(100, 0.75 * feedbackScore + 0.25 * responseScore))`.  
  If not: `score = round(min(100, feedbackScore))`.

## Badges (independent)

| Badge ID | Rules |
|----------|--------|
| `topReviewed` | `totalReviews >= 5` and `averageRating >= 4.5` |
| `reliableTrader` | `totalReviews >= 10` and `averageRating >= 4.6` |
| `fastResponder` | `replySampleCount >= 5` and median `<= 48` hours |

Badges are not mutually exclusive.

## API / DTO

Public payloads must not include message bodies. Include only aggregates: median hours, sample count, score, badges, review average, review count.
