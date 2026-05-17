# Shadow and Sillage — Improvements v2

Building on the completed Waves 1, 2, and 3A–3E + 3H, this document defines what needs to happen next to make Shadows the world-class, community-first fragrance trading platform.

**Core constraint (unchanged):** The platform connects traders — it does not move money. All payment and shipping coordination happens off-platform.

---

## What's Already Shipped

The following is a summary of the completed foundation. Do not re-implement or duplicate any of this work.

| Wave | What's done |
|------|-------------|
| **1A–1F** | Trade/TradeLineItem/TradeEvent schema, user reports + evidence photos, admin strikes/bans, reports queue, listing photos + condition metadata, avatar/profile fields, region + social links, transactional email |
| **2A** | Full trade lifecycle (create, accept, decline, ship, receive, complete, cancel), trade composer modal, TradeStatusCard in threads, inbox active-trade badges, profile trade tabs, 15-second polling |
| **2B** | Reputation signals: completed trade count, member-since date, fast-responder badge, reliability score, community policy page |
| **2C** | Exchange discovery filters: trade preference, bottle type, condition, region, has-photos toggle |
| **2D** | Wishlist matching: "Matches for you," "Someone wants what you have," wishlist overlap banner, compare → find traders CTA |
| **2E** | Activity feed: "Just listed" on exchange + home, "New this week" nav badge |
| **2F** | Seasonal trending: top 10 per season, auto-updated |
| **2G** | Web push: trade + message alerts, push opt-in in alert preferences, trade nav badge |
| **3A** | Three-step onboarding: quiz, first listing, first match |
| **3B** | Scent DNA card: note families, season affinity, house-type breakdown, shareable page |
| **3C** | Quiz depth: budget, concentration, house tier, ranking signals |
| **3D** | Sanity blog (Behind the Bottle): articles cross-linked to perfumes and houses |
| **3E** | SEO: JSON-LD, OG tags, dynamic OG images, canonical URLs, sitemap, robots |
| **3H** | Experience polish: view transitions (compare, trade timeline, activity feed), GSAP stagger on exchange + feed, mobile bottom nav (exchange/messages/profile/alerts), alert-type i18n, recently-active indicator, exchange `/` and `Esc` shortcuts |

---

## Still Open From Waves 1–2

These are not new features; they are unfinished pieces of already-shipped systems.

- [ ] **IMP-031** Add "Report" button inside `TradeStatusCard` / thread; pre-fills `tradeId` on the report form (report system is shipped; only the trade-scoped entrypoint is missing)
- [ ] **IMP-046** Add listing photo thumbnail strip + lightbox to exchange listing cards (photos are already uploaded and shown on trader profiles; exchange cards still show catalog image only)
- [ ] **IMP-063** Wire `sendTradeEventEmail` for trade milestones (Resend is configured; email templates for wishlist/decant already send; trade event emails just need to be dispatched)

---

## Competitive Landscape

### What Fragrantica does better than us (right now)
- Catalog depth: 125,000+ perfumes, 2.4 million reviews, per-note search
- Forum sections with active threads (Scent of the Day, swap boards, news)
- Cross-links between notes, houses, perfumers, accords

### What Parfumo does better than us (right now)
- Cleaner wardrobe UI with shelves, usage tracking, and longevity/sillage graphics
- "Parfumo Souk" — structured swap + giveaway + sample section
- Barcode scanning to add bottles
- Points system rewarding active members
- Ad-free experience perceived as trustworthy

### What Reddit/Facebook/Mercari do better than us (right now)
- Liquidity: more bottles, more traders, more search traffic
- Habit: users already know where to go

### What they all lack that we already have
- Guided, tracked trade lifecycle with status and audit events
- Scent DNA, quiz-driven profile, personalised recommendations
- Wishlist matching ("someone wants what you have")
- Structured listing photos with condition and ml metadata
- Real reputation signals (reliability score, fast-responder badge) linked to real trades
- Web push + email for every trade and wishlist event
- Editorial content cross-linked to the catalog (blog)

### The strategic position
No competitor combines catalog-quality discovery, a guided swap flow, structured trader reputation, and scent-profile personalisation in one place. Shadows should own that combination and deepen it.

---

## Wave A — Close the Open System Gaps

_Small surface area, high trust impact. Finish what users already expect._

### A1 — Report from inside a Trade (IMP-031)

- [ ] Add "Report this trader" button inside `TradeStatusCard` (pinned above thread messages)
- [ ] Pre-fill `tradeId` and counterparty user ID in the existing `ReportTraderModal`
- [ ] No new schema needed; `UserReport.tradeId` FK already exists

### A2 — Listing Photos on Exchange Cards (IMP-046)

- [ ] Add first listing photo thumbnail to exchange listing cards in `TheExchangeClient`
- [ ] Fall back to catalog `perfume.image` if no listing photos uploaded
- [ ] Show condition badge overlay on the photo (same as trader profile thumbnails)

### A3 — Trade Milestone Emails (IMP-063)

- [ ] Wire `sendTradeEventEmail` in `trade.server.ts` for: `trade_received`, `trade_accepted`, `trade_shipped`, `trade_completed`
- [ ] Reuse existing plain-text template pattern from `utils/alert-email.server.ts`
- [ ] Gate on existing `emailWishlistAlerts` preference pattern; add `emailTradeAlerts` toggle

### A4 — Dispute Center MVP

- [ ] Extend existing admin reports queue with dispute intake: allow either party to open a formal dispute from a trade
- [ ] Dispute record tracks: initiating party, trade ID, category, description, status (open / under review / resolved / closed), admin notes, resolution outcome
- [ ] Admin resolves with outcome options: no action / warning issued / strike issued / trade voided
- [ ] Email both parties when resolution is reached (using Resend; mirrors existing `mailto` admin action)
- [ ] Link to community policy page from dispute flow

### A5 — Trust-adjacent QoL

- [x] **IMP-274** Add "Recently active" indicator (last seen within 7 days) on trader profiles and inbox rows — shipped in Wave 3H (`User.lastActiveAt`, `RecentlyActiveBadge`, activity ping)
- [ ] **SEC-001** Optional 2FA for admin accounts and high-trust traders
- [ ] **SEC-002** Suspicious login heuristics (new device, new region, repeated failures) with user alert
- [ ] **SEC-003** Trust-tiered rate-limit profiles (higher limits for accounts with completed trades and no strikes)

---

## Wave B — Get More Bottles Into the System

_Trade lifecycle, matching, alerts, and reputation all exist. They need more inventory to compound._

### B1 — Bulk Inventory Editor (IMP-250–254)

- [ ] **IMP-250** Multi-row inventory grid: add multiple `UserPerfume` rows in one session with inline perfume name search
- [ ] **IMP-251** CSV import: accept `.csv` with columns `perfumeName`, `house`, `mlRemaining`, `condition`, `tradePreference`
- [ ] **IMP-252** Fuzzy-match each CSV row against catalog; bucket: confident (green) / uncertain (yellow) / no match (red)
- [ ] **IMP-253** 3-step import review screen: confirm matches, pick suggestions for uncertain rows, submit unmatched to catalog queue
- [ ] **IMP-254** Unmatched rows create `PendingSubmission` + draft `UserPerfume`; activate automatically on admin approval

### B2 — Fragrantica Collection Import (IMP-255)

- [ ] **IMP-255** Accept Fragrantica collection page URL; scrape owned fragrances; run through same fuzzy-match + review flow as CSV
- [ ] Parfumo XML export (downloadable from their site) as a secondary import target

### B3 — Private Wardrobe vs. Public Listings (IMP-256)

- [ ] **IMP-256** Add "My Wardrobe" (all owned, private) vs. "My Listings" (available, exchange-visible) view split in user inventory
- [ ] Wardrobe items can be marked "not trading" without being deleted
- [ ] Wardrobe view shows collection stats (houses, families, total value of traded bottles)

### B4 — Barcode / QR Scanning

- [ ] Add barcode scan entry point in the listing editor (mobile camera; reuse existing `getUserMedia` infrastructure from `ImageUploader`)
- [ ] Match scanned UPC/EAN against catalog; pre-fill perfume name and house
- [ ] Fall back to manual search if no match found

---

## Wave C — Turn Existing Activity Into Community

_Layer community graph and social identity on top of the shipped reputation, Scent DNA, activity feed, and editorial content._

### C1 — Follow System (IMP-F02 / CF-050–052)

- [ ] Follow traders, houses, and reviewers
- [ ] `UserFollow` model: `followerId`, `followingUserId?`, `followingHouseId?`, `followingPerfumeId?`, `createdAt`
- [ ] Followed activity in the existing activity feed: new listings, completed trades, new reviews, new blog articles
- [ ] Notification preferences for followed activity (gated behind existing `UserAlertPreferences` pattern)
- [ ] "X people follow this trader" count on trader profiles

### C2 — Contributor Badges

- [ ] Reuse existing signals (fast-responder badge already exists; reliability score already exists)
- [ ] New badges:
  - **Trusted Swapper** — ≥ 5 completed trades with no strikes
  - **Helpful Reviewer** — ≥ 3 reviews with net positive helpfulness votes
  - **Rare Collector** — holds or has traded ≥ 1 perfume from a house with fewer than 50 members
  - **Decant Host** — organised ≥ 1 completed decant split
  - **Community Pillar** — follows 10+ traders AND is followed by 10+
- [ ] Badges surface on trader profile header alongside existing reputation chips

### C3 — Review Helpfulness (CF-040–042)

- [ ] **CF-040** Helpful / unhelpful voting on `TraderFeedback` reviews
- [ ] **CF-041** Surface top reviews by helpfulness + recency (not just newest)
- [ ] **CF-042** "Verified swap" marker on reviews linked to a completed trade (FK already exists)

### C4 — Scent Journey Timeline (IMP-F03 / CF-060)

- [ ] Chronological public timeline on trader profile: bottles added, trades completed, reviews written, Scent DNA changes, blog mentions
- [ ] Each event is a card: date, type icon, brief description, CTA (view trade / view review / view perfume)
- [ ] Private events (declined trades, removed listings) are excluded
- [ ] Reuses existing `TradeEvent`, `TraderFeedback`, `UserPerfume`, and blog cross-link data — no new schema needed

### C5 — Community Stats Strip (IMP-263)

- [ ] **IMP-263** Home page strip: "X bottles listed · X trades completed this month · X members" — aggregate DB counts cached hourly
- [ ] Motivates new users and signals platform health to casual visitors

### C6 — Shareable Links (IMP-260–262)

- [ ] **IMP-260** Public/private toggle on `UserPerfumeWishlist`; shareable URL `/wishlist/[userId]`
- [ ] **IMP-261** `/trades/[tradeId]` visible only to participants and admin (useful for off-platform DM references)
- [ ] **IMP-262** "Copy link" button on trader profile and wishlist pages for sharing on Reddit / Discord

---

## Wave D — Build the Moat

_Features that compound over time and are hard for a catalog-only or swap-group alternative to replicate quickly._

### D1 — Saved Searches and Alerts (IMP-F05 / CF-020–023)

- [ ] **CF-020** Save current search/filter state to a named saved search (perfume, house, region, condition, trade preference)
- [ ] **CF-021** Alert rules per saved search: notify when new listings match (instant / daily digest)
- [ ] **CF-022** Alert center with mute/snooze controls per rule
- [ ] **CF-023** Alert frequency settings (instant / daily / weekly)
- [ ] Saved searches extend existing `UserAlertPreferences` and Resend email pipelines

### D2 — Trade Match Score

- [ ] Surface a "why this swap fits" explanation on every wishlist match and recommended listing card
- [ ] Score factors: wishlist overlap depth, Scent DNA family match, shared region (shipping ease), counterparty response speed, counterparty reliability score, trade history with similar items
- [ ] Explanation copy examples: "They want what you have," "Same region → easier shipping," "Top-rated swapper," "Your DNA overlaps on woods and orientals"
- [ ] Reuses shipped signals; no new schema needed for v1

### D3 — Decant Splits (IMP-F01)

- [ ] `DecantSplit` model: `id`, `hostUserId`, `perfumeId`, `totalMl`, `status` (open/filling/shipped/completed), `priceHint`, `notes`, `createdAt`
- [ ] `DecantSplitSlot` model: `id`, `splitId`, `claimantUserId?`, `ml`, `status` (open/claimed/paid/received)
- [ ] Host creates split; claimants claim slots; host marks shipped; claimants confirm received
- [ ] Host reputation extended with "Decant Host" badge after first completed split
- [ ] Off-platform payment disclaimer on every split page
- [ ] Notify all slot claimants when host marks shipped (push + email)

### D4 — Real-Time Messaging (IMP-F04)

- [ ] Upgrade `ThreadClient` from 15-second polling to Server-Sent Events (SSE) or WebSocket
- [ ] SSE is the lower-complexity first step: one persistent connection per thread, server pushes new messages
- [ ] Keep polling fallback for clients that cannot maintain SSE connections

### D5 — Trade Templates (IMP-F06)

- [ ] Save a frequently used swap offer configuration (e.g. "always offer my 10ml Aventus sample in exchange")
- [ ] Template pre-fills `TradeComposerModal` with offering items and a default note
- [ ] Up to 5 saved templates per user (free); unlimited for Plus members

### D6 — Collection Intelligence

- [ ] "Trade candidates" surface on user's wardrobe: bottles they haven't used recently and that appear on other traders' wishlists
- [ ] "Seasonal gaps" insight: based on Scent DNA season affinity, suggest categories they're missing for the current season
- [ ] "Duplicate alert": two listings for very similar items in the same wardrobe (same perfume, different sizes)
- [ ] All computed from existing `UserPerfume`, `UserPerfumeSeasonVote`, and wishlist data

---

## Wave E — Monetization (After Trust and Community Are Mature)

_Monetization should feel like acceleration for serious users, not friction for everyone else._

### E1 — Shadows Plus Subscription

- [ ] **MZ-P-001** Monthly plan at `$7.99`
- [ ] **MZ-P-002** Monthly + annual (2 months free)
- [ ] **MZ-P-003** Intro offer for first 30 days

Candidate Plus benefits:
- Unlimited saved search bundles (free tier: 3)
- Priority alert delivery (free tier: daily digest; Plus: instant)
- Advanced collection intelligence insights
- Unlimited trade templates (free tier: 5)
- Collection export (CSV)
- Profile "Verified Plus" badge

### E2 — Boosted Listing Visibility

- [ ] **MZ-B-001** 24h boost
- [ ] **MZ-B-002** 72h boost
- [ ] **MZ-B-003** Multi-listing bundle
- Sponsored badge mandatory; capped boost density per page; relevance floor before eligibility

### E3 — Affiliate Commerce

- [ ] Show verified purchase alternatives on perfume detail when no trade is found
- [ ] "Best match in stock" module with explicit affiliate disclosure
- [ ] Seasonal editorial collections with transparent affiliate partner labeling

---

## Experience Polish (Wave 3H — ✅ shipped May 2026)

- [x] **IMP-270** Extend View Transitions to trade timeline and compare navigation
- [x] **IMP-271** GSAP stagger animation on exchange grid load and "Just listed" feed
- [x] **IMP-272** Mobile bottom navigation bar (exchange, messages, profile, alerts) optimised for thumb reach
- [x] **IMP-273** i18n strings for all new trade states, condition labels, and alert types via `next-intl`
- [x] **IMP-274** "Recently active" indicator on trader profiles and inbox rows (see A5)
- [x] **IMP-275** Keyboard shortcut `/` to focus exchange search; `Esc` to clear filters

**Shipped in:** `utils/view-transition-names.ts`, `TradeStatusTimeline`, compare/activity feed transitions; `hooks/useGsapStagger.ts`; `MobileBottomNavigation` + layout; `AlertItem` + `alerts.types`/`actions`/`timeAgo`; `User.lastActiveAt` + `RecentlyActiveBadge` + `/api/activity/ping`; exchange keyboard shortcuts.

**Still open (QoL carry-forward):**

- [ ] **QOL-001** Bulk edit for inventory attributes (price hint, amount, trade preference)
- [ ] **QOL-002** Draft autosave for long reviews and messages
- [ ] **QOL-003** Better empty states with one-click next actions
- [ ] **QOL-010** Smarter prefetch on high-intent hover targets
- [ ] **QOL-011** Skeleton and progressive loading consistency across major routes

---

## Operations and Safety (carry-forward from QOL plan)

- [ ] **OPS-001** Structured server logs with request IDs
- [ ] **OPS-002** Error monitoring + route-level alert thresholds
- [ ] **OPS-003** Performance dashboard for p95 latency and key route regressions
- [ ] **OPS-010** Data quality queue (duplicate/missing-note/mismatch checks)
- [ ] **OPS-011** Moderation inbox with full status workflow
- [ ] **OPS-012** Dispute intake + resolution tracking (see Wave A4 above)
- [ ] **OPS-020** Incident playbook docs and severity matrix
- [ ] **OPS-021** Admin runbooks for common issues

---

## Execution Order Summary

```
Wave A  →  Close open gaps + dispute center + trust security
Wave B  →  Bulk inventory, import, wardrobe/listing split, barcode
Wave C  →  Follows, badges, review helpfulness, journey, stats, shareable links
Wave D  →  Saved searches, Match Score, decant splits, real-time chat, templates, collection intelligence
Wave E  →  Plus subscription, boosted listings, affiliate
Polish  →  QoL (3H mobile nav, animations, shortcuts, i18n — done)
Ops     →  Monitoring, moderation inbox, runbooks (run in parallel with all waves)
```

---

## Success Metrics

- **Browse-to-message rate** — does better matching drive more first contacts?
- **Message-to-trade rate** — does the trade flow convert conversations into proposals?
- **Trade completion rate** — are swaps actually getting done?
- **Dispute rate** — is trust holding as volume grows?
- **D30 retention** — do users come back after their first trade or match?
- **Inventory growth** — bottles listed per week (key unlock for matching quality)
- **Saved search creation** — signals intent depth
- **Plus conversion** — premium attach rate after saved searches launch

---

## Notes

- All authenticated API routes must mirror auth, CSRF, and rate-limit patterns in `app/api/contact-trader/route.ts`
- Schema changes use `prisma migrate dev` locally and `prisma migrate deploy` for production; never `prisma db push`
- Monetization must not degrade trust in rankings or recommendations — paid placements require clear labels and relevance floors
- Any score shown to users (Match Score, reputation) must be explainable in plain language
