# Contributor badges — canonical rules (Phase 1)

**Implementation:** [`services/reputation/contributor/`](../services/reputation/contributor/)  
**Related:** [Trader reputation v1](./reputation-v1-spec.md) (separate badge family)

Contributor badges reward sustained community contribution. They are independent of reputation v1 badges (`topReviewed`, `reliableTrader`, `fastResponder`) and are merged in the trader profile header UI.

## Phase 1 badges

| Badge ID | Rules |
|----------|--------|
| `trustedSwapper` | `completedTradeCount >= 5` and `strikeCount === 0` |
| `communityPillar` | `followingUserCount >= 10` and `followerCount >= 10` (user follows only) |
| `rareCollector` | User **holds** or has **completed-trade** exposure to ≥1 perfume whose `perfumeHouseId` has fewer than 50 distinct collectors (`UserPerfume.userId` per house) |
| `helpfulReviewer` | ≥3 `TraderFeedback` rows authored by the user where `helpfulCount - unhelpfulCount > 0` |

Badges are not mutually exclusive.

### Trusted Swapper

- `completedTradeCount` uses the same definition as reputation v1: trades with `status === completed` where the user is initiator or counterparty.
- `strikeCount` is `User.strikeCount` (admin-issued strikes).

### Community Pillar

- `followerCount`: rows in `UserFollow` where `followingUserId === trader`.
- `followingUserCount`: rows where `followerId === trader` and `followingUserId` is not null.

### Rare Collector

**Candidate houses** = union of:

1. Houses of perfumes in the user's `UserPerfume` collection (any availability).
2. Houses of perfumes on `TradeLineItem` rows for trades with `status === completed` where the user is initiator or counterparty.

For each candidate house, count **distinct** `UserPerfume.userId` where `perfume.perfumeHouseId` equals that house. If any count is **strictly less than** 50, award the badge.

Performance: skip when no candidate houses; cap candidates at 100 per profile.

## Deferred (Phase 2)

| Badge ID | Prerequisite | Planned rule |
|----------|--------------|--------------|
| `decantHost` | D3 decant splits | ≥1 completed decant split as host |

## API / DTO

`contributorBadges: ContributorBadgeIdPhase1[]` is returned on trader feedback profile payloads (`getTraderFeedbackForProfile`, `GET /api/trader-feedback`). Strike count is never exposed publicly; it is only used server-side for computation.

## Constants

See [`services/reputation/contributor/constants.ts`](../services/reputation/contributor/constants.ts).
