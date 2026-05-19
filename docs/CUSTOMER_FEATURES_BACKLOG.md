# Customer Features Backlog

Customer-facing roadmap focused on discovery quality, trust, and retention loops.

## Tier A: Must-Ship Features

### Compare Mode

- [x] **CF-001** Add compare tray to perfume cards (add/remove items). Implementation: see [`docs/compare-client.md`](./compare-client.md).
- [x] **CF-002** Compare page with notes, ratings, availability, and house context
- [x] **CF-003** Share compare URL with embedded state
- [x] **CF-004** "Best for you" highlight based on profile signals

### Advanced Discovery

- [x] **CF-010** Unified filter panel (notes, season, house, price range)
- [x] **CF-011** Filter chips with quick remove/reset (`FilterChipStrip` + `/the-exchange` chip row)
- [x] **CF-012** Persist filter state per user/session (URL: session + shareable links; per-account storage still CF-020)
- [x] **CF-013** Explain recommendation reason in UI ("shown because..."). Server attaches `reason` on `RecommendationPerfume`; `RecommendationReasonLine` on profile (`RecommendedForYou`) and perfume detail similar grid.

### Saved Searches and Alerts

- [ ] **CF-020** Save current search criteria
- [ ] **CF-021** Alert rules for availability, price movement, and new matches
- [ ] **CF-022** Alert center with mute/snooze controls
- [ ] **CF-023** Alert frequency settings (instant/daily digest)

## Tier B: Trust and Community

### Reputation Layer

- [x] **CF-030** Trader reputation score v1
- [x] **CF-031** Breakdown badges (fast responder, reliable trader, top reviewed) + contributor badges Phase 1 (trusted swapper, community pillar, rare collector)
- [x] **CF-032** Public trust profile summary

### Review Quality

- [x] **CF-040** Helpful/unhelpful voting
- [x] **CF-041** Top review surfaces by helpfulness + recency
- [x] **CF-042** Verified trade/purchase markers (when evidence available)

### Social-lite

- [x] **CF-050** Follow houses/traders/reviewers
- [x] **CF-051** Lightweight feed of followed activity
- [x] **CF-052** Notification preferences for follows

## Tier C: Delight and Retention

- [x] **CF-060** "Scent journey" timeline of user activity
- [ ] **CF-061** Seasonal collection suggestions personalized by profile
- [ ] **CF-062** Re-engagement nudges for abandoned watchlists

## UX Guardrails

- Avoid dark patterns around paid upgrades
- Keep controls understandable without onboarding
- Any score shown to users must be explainable

## Metrics Per Feature Cluster

- **Compare:** compare sessions/week, share rate, downstream trade intent
- **Discovery:** filter usage depth, result interaction rate, save-search conversion
- **Trust:** message acceptance rate, profile bounce, dispute rate trend
