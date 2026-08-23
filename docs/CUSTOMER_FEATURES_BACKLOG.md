# Customer Features Backlog

Customer-facing roadmap focused on discovery quality, trust, and retention loops.

## Tier A: Must-Ship Features

### Compare Mode

- [x] **CF-001** Add compare tray to perfume cards (add/remove items). Implementation: `hooks/compareStore.ts`, `components/Molecules/CompareTray`.
- [x] **CF-002** Compare page with notes, ratings, availability, and house context
- [x] **CF-003** Share compare URL with embedded state
- [x] **CF-004** "Best for you" highlight based on profile signals

### Advanced Discovery

- [x] **CF-010** Unified filter panel (notes, season, house, price range)
- [x] **CF-011** Filter chips with quick remove/reset (`FilterChipStrip` + `/the-exchange` chip row)
- [x] **CF-012** Persist filter state per user/session (URL: session + shareable links; per-account storage still CF-020)
- [x] **CF-013** Explain recommendation reason in UI ("shown because..."). Server attaches `reason` on `RecommendationPerfume`; `RecommendationReasonLine` on profile (`RecommendedForYou`) and perfume detail similar grid.

### Saved Searches and Alerts

Save + matcher + Community Alerts manager already exist (`SavedSearch`, `SaveSearchButton` on Archive/Exchange, cron match pass, Premium entitlements). Remaining work is **one inbox** and clearer rules — see [product-roadmap.md](./product-roadmap.md) Phase 1. Do not add a second Alerts hub.

- [x] **CF-020** Save current search criteria (API + Archive/Exchange button + Community → Alerts list)
- [ ] **CF-021** Alert rules for availability, price movement, and new matches — **deferred**: matcher covers new listing/catalog; price-movement rules wait until listing price history exists (see invite-beta launch sequence)
- [x] **CF-022** Alert center with mute/snooze — Community → Alerts manages rules; snooze + unified header `UserAlert` bell inbox
- [x] **CF-023** Alert frequency settings (instant vs daily digest)

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
- [x] **CF-061** Seasonal collection suggestions personalized by profile (Scent DNA + quiz prefs + wear journal)
- [x] **CF-062** Re-engagement nudges for abandoned wishlists (digest “Still on your wishlist” + weekly cron UserAlert; never call it watchlist)
- [x] **CF-063** Wear journal → taste graph flywheel + structured wear context
- [x] **CF-064** Collection Intelligence Hub (Premium analytics + Collector CSV)
- [x] **CF-065** What-to-wear suggestions from owned bottles
- [x] **CF-066** In-app personalized digest page (+ email deep-link)
- [x] **CF-067** Community challenges (join, detail, tray loop, seed)
- [x] **CF-068** Taste-based Exchange discovery + mutual swap suggestions
- [x] **CF-069** Declared (quiz) vs actual (shelf) Scent DNA
- [x] **CF-070** Advanced collection intelligence (redundancy, gaps, decant mix)
- [x] **CF-071** Premium compare limit (`unlimited_comparisons`)
- [x] **CF-072** House / indie radar from followed houses
- [ ] **CF-073** Structured decant circles (deferred — implement as invite-only / recurring **group splits**, not a new noun; roadmap Phase 6)

### Next loops (no new hubs)

Sequencing, conflict map, and Collector’s Guide policy: [product-roadmap.md](./product-roadmap.md).

- [x] **CF-074** Unify saved-search, wishlist, trade, and follow notices onto the existing UserAlert bell + one preference sheet
- [x] **CF-075** Public looking-for via **wishlist** visibility + Exchange region filter (`User.region` / `same_region` already in trade-match). No ISO board.
- [x] **CF-076** Shared deal checklist on 1:1 trades (photos, tracking, shipped/received — same language as splits)
- [x] **CF-077** Sampling-queue UI on digest + My Scents (model + digest snippet exist)
- [ ] **CF-078** Note/material pages under the Archive (`NoteMaterial` already powers scoring) — not a nav item until content exists

## UX Guardrails

- Avoid dark patterns around paid upgrades
- Keep controls understandable without onboarding
- Any score shown to users must be explainable

## Metrics Per Feature Cluster

- **Compare:** compare sessions/week, share rate, downstream trade intent
- **Discovery:** filter usage depth, result interaction rate, save-search conversion
- **Trust:** message acceptance rate, profile bounce, dispute rate trend
