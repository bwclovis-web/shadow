# Shadow and Sillage — Improvements Backlog

Granular, incremental tasks broken into three waves. Each item is small enough to ship independently. Complete Wave 1 before moving to Wave 2; Wave 3 items can run in parallel once Wave 2 is stable.

**Core constraint:** the platform connects traders — it does not move money. All payment and shipping coordination happens off-platform.

---

## Wave 1 — Trust Foundation

_Nothing in Wave 2 is meaningful without listing photos, a trade record, and a safe community. These are the unlock._

### Wave 1 progress (May 2026)

| Section | Status | Items |
|---------|--------|-------|
| **1A** Schema | ✅ Done | IMP-001–014 |
| **1B** Trader strikes (admin) | ✅ Done | IMP-020–027 |
| **1C** User reports | ✅ Done | IMP-030, 032–033 (IMP-031 deferred to 2A) |
| **1D** Listing photos | ✅ Done | IMP-040–047 |
| **1E** Trader avatar / profile | ✅ Done | IMP-050–053 (IMP-051 trade timeline deferred to 2A) |
| **1F** Email delivery | ✅ Done | IMP-060–062, 064 (IMP-063 deferred to 2A) |

**Next up:** Wave 2A — Trade Lifecycle

### 1A — Schema (single `prisma db push`) ✅

- [x] **IMP-001** Add `Trade` model: `id`, `initiatorId`, `counterpartyId`, `status` enum (`draft/pending/accepted/shipped/received/completed/declined/cancelled`), `notes`, `createdAt`, `updatedAt`
- [x] **IMP-002** Add `TradeLineItem` model: `id`, `tradeId`, `userPerfumeId`, `role` (`offered`/`requested`), snapshot fields (`perfumeName`, `mlSnapshot`, `conditionSnapshot`) — no monetary fields
- [x] **IMP-003** Add `TradeEvent` model (append-only audit log): `id`, `tradeId`, `type`, `actorUserId`, `metadata` JSON, `createdAt`
- [x] **IMP-004** Extend `AlertType` enum with trade event types: `trade_received`, `trade_accepted`, `trade_shipped`, `trade_completed`, `trade_cancelled` (snake_case to match existing `AlertType` values)
- [x] **IMP-005** Add `tradeId String?` (nullable FK) to `TraderContactMessage` to link threads to trades
- [x] **IMP-006** Add `tradeId String?` (nullable FK) to `TraderFeedback` so reviews are tied to real deals
- [x] **IMP-007** Add listing-quality fields to `UserPerfume`: `images String[]`, `condition` enum (`sealed/mint/lightlyUsed/heavilyUsed/damaged`), `decantFormat` enum (`atomizer/vial/original`), `mlRemaining Float?`
- [x] **IMP-008** Add `pendingSubmissionId String?` (nullable FK to `PendingSubmission`) to `UserPerfume` for draft listings pending catalog approval
- [x] **IMP-009** Add to `User`: `avatarImage String?`, `region String?`, `instagramHandle String?`, `fragranticaUrl String?`, `redditUsername String?`
- [x] **IMP-010** Add `UserStrike` model: `id`, `userId`, `issuedBy` (admin userId), `reason String`, `createdAt`
- [x] **IMP-011** Add `strikeCount Int @default(0)` and `isBanned Boolean @default(false)` to `User`
- [x] **IMP-012** Add `UserReport` model: `id`, `reporterId`, `reportedUserId`, `tradeId?`, `category` (enum: `scam/fakeItem/harassment/noShip/other`), `description String?`, `status` (`pending/reviewed/actioned`), `createdAt`
- [x] **IMP-013** Add `User.onboardingCompletedAt DateTime?` for onboarding state tracking
- [x] **IMP-014** Run `prisma db push` — all above in one push, all additive, no data loss (local `new_scent` @ localhost, May 2026)

**Shipped in:** `prisma/schema.prisma` — run `npm run db:push` on each environment, then `npm run db:generate` (restart dev server if Prisma client was cached).

### 1B — Trader Strike System (admin) ✅

- [x] **IMP-020** Create `issueStrikeAction` server action: increments `strikeCount` and sets `isBanned = true` if result `>= 3`, atomically in a transaction
- [x] **IMP-021** Add `isBanned` check to login / `requireAuth`: reject session with "Your account has been suspended" message before JWT is issued
- [x] **IMP-022** Add Strikes column to [`UserRow`](../app/admin/users/UserRow.tsx): coloured pip indicators (grey = 0, amber = 1–2, red = 3+), "BANNED" badge when `isBanned`
- [x] **IMP-023** Add "Issue Strike" button to `UserRow`: opens reason modal (reuse `ConfirmDeleteModal` pattern), calls `issueStrikeAction` on confirm; disabled for current user and already-banned users
- [x] **IMP-024** Add search bar to [`UsersClient`](../app/admin/users/UsersClient.tsx): client-side filter across `displayName`, `email`, `username` via `useState` + `useMemo`
- [x] **IMP-025** Add Role filter to `UsersClient`: dropdown All / user / editor / admin using existing `UserRole` enum
- [x] **IMP-026** Add Strike filter to `UsersClient`: All / No strikes / 1 strike / 2 strikes / Banned; filters compose with search and role filter
- [x] **IMP-027** Show "Showing X of Y users" count below filters

**Shipped in:** `models/admin.server.ts` (`issueStrike`), `app/admin/users/actions.ts`, `app/admin/users/UsersClient.tsx`, `UserRow.tsx`, `StrikeIndicators.tsx`, `ConfirmStrikeModal.tsx`; auth in `app/(auth)/sign-in/actions.ts`, `utils/session-from-request.server.ts`, `models/session.server.ts`; `lib/db.ts` (`PRISMA_CLIENT_VERSION` for dev client refresh).

### 1C — User Report System ✅

- [x] **IMP-030** Add "Report" button to trader profile page; opens modal with category dropdown + optional description field; calls `createUserReportAction`
- [ ] **IMP-031** Add "Report" button inside trade timeline (once built); pre-fills `tradeId` on the report — deferred until trade timeline (Wave 2A)
- [x] **IMP-032** Add Reports queue tab to admin panel (alongside pending submissions); shows unreviewed reports with reporter, reported user, category, trade link
- [x] **IMP-033** Add "Issue Strike" shortcut from report detail so admin can act in one click

**Shipped in:** `models/user-report.server.ts`, `app/trader-profile/actions.ts`, `components/Containers/TraderProfile/ReportTraderButton.tsx`, `components/Containers/Forms/ReportTraderModal.tsx`, `app/trader-profile/[id]/aside/aside.tsx`; admin queue at `app/admin/reports/` (`ReportsClient.tsx`, `actions.ts`); nav entry `data/navigation.ts` → `/admin/reports`. Strike-from-report reuses `ConfirmStrikeModal` with prefilled reason.

**Enhanced (May 2026):** Optional evidence photos (`POST /api/report-images`, `ImageUploader` in report modal); dispute statuses `inProgress` / `settled` / `passed`; admin mailto emails for both parties; admin delete report; reporter withdraw at `/{slug}/profile/reports` while `inProgress`.

### 1D — Listing Photos and Condition ✅

- [x] **IMP-040** Build `ImageUploader` component: feature-detect `navigator.mediaDevices?.getUserMedia`; if available, show "Use Camera" button opening a `<video>` viewfinder modal with capture; always show drag-and-drop zone as primary/fallback
- [x] **IMP-041** Camera capture flow: draw captured frame to `<canvas>`, convert to `Blob`, compress client-side, upload to R2 via `POST /api/listing-images` (server `uploadToR2`)
- [x] **IMP-042** Add condition selector (sealed / mint / lightly used / heavily used / damaged) to listing editor
- [x] **IMP-043** Add decant format selector (atomizer / vial / original) and `mlRemaining` numeric input to listing editor; shown when listing amount is partial vs owned bottle size
- [x] **IMP-044** Require at least 1 photo before a listing is published to the exchange (`LISTING_REQUIRE_PHOTO=false` to relax)
- [x] **IMP-045** Render horizontal thumbnail strip in [`ItemsToTrade`](../components/Containers/TraderProfile/ItemsToTrade/ItemsToTrade.tsx) below `PerfumeHeader`; each thumbnail is 80×80; clicking opens lightbox (reuse existing `Modal`) with prev/next arrows
- [ ] **IMP-046** Add same thumbnail strip + lightbox to exchange listing cards — **deferred**; exchange cards use catalog `perfume.image` only
- [x] **IMP-047** Overlay condition badge and `TradePreference` chip on listing thumbnails (trader profile / destash editor; not on exchange grid)

**Shipped in:** `components/Molecules/ImageUploader/`, `components/Molecules/ListingPhotos/`, `app/api/listing-images/route.ts`, `models/listing-metadata.server.ts`, `utils/listing-images-client.ts`, `utils/listing-config.server.ts`, `utils/listing-display.ts`; wired in `DeStashForm`, `DestashManager`, `user.server.ts`, `user-perfumes` API, `ItemsToTrade` (large lightbox). Exchange browse (`TheExchangeClient`) shows catalog image only; listing photos remain on trader profile.

### 1E — Trader Avatar and Profile Fields ✅

- [x] **IMP-050** Add avatar image upload to user profile settings page (R2 pipeline, same component as IMP-040)
- [x] **IMP-051** Surface avatar on trader profile header, message inbox rows, and trade timeline events — **trade timeline deferred** until Wave 2A trade UI exists
- [x] **IMP-052** Add region field to profile settings; surface as a chip on trader profile
- [x] **IMP-053** Add optional social links (Fragrantica URL, Reddit username, Instagram handle) to profile settings; render as small icon links on trader profile

**Shipped in:** `app/api/avatar-images/route.ts`, `utils/avatar-images-client.ts`, `utils/validation/fieldSchemas.ts` (`avatarImageSchema`); profile form in `app/[userSlug]/profile/ProfileClient.tsx` + `actions.ts` (`UpdateProfileSchema`); `components/Molecules/TraderAvatar/`, `components/Molecules/CountryTypeahead/`, `components/Atoms/CountryFlagBadge/`, `utils/country-list.ts` (shared with `data/countryList.json`); trader display in `app/trader-profile/[id]/TraderProfileClient.tsx` (avatar in `TitleBanner`), `app/trader-profile/[id]/aside/aside.tsx` + `components/Containers/TraderProfile/TraderProfileAboutExtras.tsx` + `TraderSocialLinks.tsx`; messages in `app/messages/MessagesClient.tsx`, `app/messages/[otherUserId]/ThreadClient.tsx`; `models/user.server.ts` / `models/user.query.ts` / `models/contactMessage.server.ts`; `hooks/useTrader.ts` (refetch on mount after profile edits); `flagcdn.com` in `next.config.ts` `remotePatterns`.

**IMP-052 details:** Region uses the same country list as perfume houses (`CountryTypeahead` + hidden field stores country `id`). Trader profile About section shows country name with a PNG flag (`CountryFlagBadge` via flagcdn; ISO code fallback if the image fails). Legacy region values (`US`, `UK`, `AU`, `EU`, `other`) still resolve for display.

**IMP-051 partial:** Avatars on trader profile banner and message inbox/thread rows are live; trade timeline avatars wait on IMP-107+ (2A).

### 1F — Email Delivery ✅

- [x] **IMP-060** Install and configure Resend; store `RESEND_API_KEY` and `EMAIL_FROM` in env
- [x] **IMP-061** Wire `sendWishlistAlertEmail` when a wishlisted item is listed (gated by `wishlistAlertsEnabled` + `emailWishlistAlerts`)
- [x] **IMP-062** Wire `sendDecantInterestAlertEmail` (gated by `decantAlertsEnabled` + `emailDecantAlerts`)
- [ ] **IMP-063** Add `sendTradeEventEmail` for trade milestones — **deferred to Wave 2A** when trade transition API exists
- [x] **IMP-064** Plain-text transactional templates (perfume link + profile preferences link); HTML/noir branding deferred to v2

**Shipped in:** `resend` package; `utils/email.server.ts`, `utils/alert-email.server.ts`; dispatch from `models/user-alerts.server.ts` after `createUserAlert`; re-exports in `utils/alert-processors.ts`; dependent email toggles in `AlertPreferences.tsx`; env documented in `docs/new computer set up.md`.

---

## Wave 2 — Discovery and Engagement

_These features make the platform sticky. Users return because they have active trades, matches, and alerts._

### 2A — Trade Lifecycle API and UI

- [x] **IMP-100** Create `app/api/trades/` route group; mirror auth, CSRF, and rate limits from [`app/api/contact-trader/route.ts`](../app/api/contact-trader/route.ts)
- [x] **IMP-101** Implement `POST /api/trades` (create draft): validates `initiatorId`, `counterpartyId`, `lineItems`; creates `Trade` + `TradeLineItem` rows; fires `TradeEvent`
- [x] **IMP-102** Implement status transition endpoints: accept, decline, ship (with optional tracking number), receive, complete, cancel
- [x] **IMP-103** Each transition appends a `TradeEvent` and fires the corresponding `AlertType`
- [x] **IMP-104** Add "Propose swap" / "Connect about this bottle" CTA to trader profile listing cards; pre-fills the trade composer modal with the `UserPerfume` context
- [x] **IMP-105** Add "Make offer" button directly on exchange listing cards; opens trade composer modal inline without navigating away
- [x] **IMP-106** Build `<TradeComposer>` modal: shows the target listing, lets the initiator select which of their own listings to offer (or propose cash/trade per `TradePreference`), adds optional notes, submits to `POST /api/trades`
- [x] **IMP-107** Build `<TradeStatusCard>` component: shows linked perfume(s), current state, and action buttons ("Mark as Shipped", "Confirm Received", "Cancel"); renders pinned above message bubbles in [`ThreadClient`](../app/messages/[otherUserId]/ThreadClient.tsx) when a `tradeId` is associated
- [x] **IMP-108** Update thread server page to load both messages and associated trade in one query
- [x] **IMP-109** Add `hasActiveTrade` boolean to `ConversationSummary`; show "Active trade" badge on inbox rows in [`MessagesClient`](../app/messages/MessagesClient.tsx)
- [x] **IMP-110** Add 15-second interval polling (or `router.refresh()` on window focus) to `ThreadClient` so received messages feel live
- [x] **IMP-111** Add "Active trades" and "Trade history" tabs to trader profile; show completed count and success rate

### 2B — Reputation ✅

- [x] **IMP-120** Surface completed trade count and member-since date on trader profile header
- [x] **IMP-121** Add "fast responder" badge: median first-reply < 24 h across last 10 threads
- [x] **IMP-122** Gate `TraderFeedback` submission on a linked `tradeId` (post-v1; v1 can remain open)
- [x] **IMP-123** Add trader reliability score: completed / (completed + cancelled-by-them) ratio; show as percentage on profile
- [x] **IMP-124** Create policy page (shipping expectations, dispute process, community rules); link from trade timeline and footer

**Shipped in:** `services/reputation/tradeStats.server.ts`, updated `loadReputationInputs.server.ts` / `computeReputation.ts` / `v1-constants.ts`; `TraderProfileHeaderStats`, `TraderTrustSummary` trade reliability; feedback gating in `models/traderFeedback.server.ts` (`TRADER_FEEDBACK_REQUIRES_COMPLETED_TRADE=false` to allow open v1); `app/community-policy/page.tsx`, `SiteFooter`, `TradeStatusCard` policy link; i18n `traderProfile.headerStats`, `communityPolicy`, `siteFooter`.

### 2C — Exchange Filter Extensions ✅

_All enums already exist — this is UI only, no schema change._

- [x] **IMP-130** Add Trade Preference filter to [`DiscoveryFiltersPanel`](../components/Organisms/DiscoveryFiltersPanel/DiscoveryFiltersPanel.tsx): cash / trade / both (existing `TradePreference` enum)
- [x] **IMP-131** Add Bottle Type filter: full bottle / partial / sample / decant (existing `WishlistBottlePreference` enum)
- [x] **IMP-132** Add Condition filter: sealed / mint / lightly used / heavily used / damaged
- [x] **IMP-133** Add Region filter: free-text or predefined list (US / EU / UK / AU / other)
- [x] **IMP-134** Add "Has photos" toggle filter (only show listings with at least one image)

**Shipped in:** `utils/discovery-filters.ts` (URL keys `tradePref`, `bottle`, `condition`, `region`, `hasPhotos`), `utils/exchange-listing-filter.server.ts` (Prisma + SQL bottle-type classification), `models/perfume.server.ts` (perfume + nested `userPerfume` where), `DiscoveryFiltersPanel`, `FilterToggleGroup`, `buildExchangeDiscoveryChipItems.ts`, `TheExchangeClient.tsx`, i18n `tradingPost.filters`.

### 2D — Wishlist Matching ✅

- [x] **IMP-140** Query: for the logged-in user, find `UserPerfume` rows (available, not own) whose `perfumeId` matches any row in the user's `UserPerfumeWishlist`; surface as "Matches for you" section on the exchange
- [x] **IMP-141** Query: for the logged-in user, find traders whose `UserPerfumeWishlist` contains perfumes the user has available; surface as "Someone wants what you have" on the user's listings page
- [x] **IMP-142** Show "You have something they want" banner at the top of a trader's profile when the visitor's collection overlaps with that trader's wishlist
- [x] **IMP-143** Make the public wishlist (`ItemsSearchingFor`) open by default on trader profiles (currently collapsed)
- [x] **IMP-144** Add "Find traders who have this" CTA on the compare page for each perfume in the comparison; links to exchange filtered by that perfume

**Shipped in:** `models/wishlist-matching.server.ts`, `WishlistMatchesSection`, `WishlistDemandSection`, `TraderWishlistOverlapBanner`; exchange `?perfume=` discovery filter; `TheExchangeClient`, `MyScentsPageClient`, `TraderProfileClient`, `ComparePageClient`; i18n `tradingPost.wishlistMatches`, `myScents.wishlistDemand`, `traderProfile.wishlistOverlap`, `compare.findTradersOnExchange`.

### 2E — Activity Feed

- [ ] **IMP-150** Add "Just listed" feed to exchange page: reverse-chronological list of recent `UserPerfume` rows with `available > 0`, showing photo thumbnail, perfume name, trader avatar, time ago
- [ ] **IMP-151** Add condensed version of the same feed to the home page as a "Latest on the exchange" section
- [ ] **IMP-152** Add "New this week" count badge to the exchange nav link

### 2F — Seasonal Trending

- [ ] **IMP-160** Query `UserPerfumeSeasonVote` aggregated by the current real-world season (spring: Mar–May, summer: Jun–Aug, fall: Sep–Nov, winter: Dec–Feb); return top 10 perfumes by vote count
- [ ] **IMP-161** Surface as "Trending this season" section on the exchange sidebar and home page
- [ ] **IMP-162** Auto-updates by season — no manual curation needed

### 2G — Web Push Notifications

- [ ] **IMP-170** Add `UserPushSubscription` model (already in schema plan): stores `userId`, `endpoint`, `p256dh`, `auth`, `createdAt`
- [ ] **IMP-171** Build push subscription opt-in UI in alert preferences: "Enable push notifications" button calls `navigator.serviceWorker` subscription flow
- [ ] **IMP-172** Deliver `tradeAccepted`, `tradeShipped`, `tradeCompleted` events via Web Push using the existing service worker
- [ ] **IMP-173** Deliver new-message alerts via Web Push when the recipient tab is not focused
- [ ] **IMP-174** Add trade alert badge count to the nav (unread trade events)

---

## Wave 3 — Moat and Retention

_These are the features no mobile-only competitor can easily replicate. They compound over time._

### 3A — Onboarding Flow

- [ ] **IMP-200** Add onboarding banner component: shown on first login (when `onboardingCompletedAt` is null); dismissible with "Skip" at any step
- [ ] **IMP-201** Step 1 — Take the quiz: surface the existing scent quiz as step 1 of onboarding; mark step complete on quiz submission
- [ ] **IMP-202** Step 2 — Add your first bottle: open listing editor pre-focused on the perfume search field; mark step complete when first `UserPerfume` is created
- [ ] **IMP-203** Step 3 — Find your first match: run wishlist + scent profile overlap query; show top 3 results with "Connect" CTAs; mark step complete on view
- [ ] **IMP-204** Set `User.onboardingCompletedAt` when all 3 steps are done (or user explicitly dismisses); remove banner permanently

### 3B — Scent DNA Card

_No new schema — all computed from existing data._

- [ ] **IMP-210** Group `ScentProfile.noteWeights` into 6 families (florals, woods, orientals, citrus, aquatics, gourmands); compute top 3 by weight
- [ ] **IMP-211** Aggregate `UserPerfumeSeasonVote` for the user into a season affinity score (0–100 per season)
- [ ] **IMP-212** Compute house type breakdown from user's `UserPerfume` collection (% indie / niche / designer)
- [ ] **IMP-213** Build `<ScentDnaCard>` component: small visual card with note family chips, season bar, and house type pills; render on public trader profile below avatar
- [ ] **IMP-214** Add a "Share my Scent DNA" button that generates a shareable OG image (or a static `/profile/[id]/scent-dna` page with good meta tags)

### 3C — Quiz Depth

- [ ] **IMP-220** Add question to scent quiz: "What's your typical budget for a new bottle?" — maps to existing `ScentProfile.preferredPriceRange` field (currently never written)
- [ ] **IMP-221** Add question: "Which concentration do you prefer?" (EDT / EDP / Parfum / no preference)
- [ ] **IMP-222** Add question: "Which house tier excites you most?" (designer / niche / indie / all)
- [ ] **IMP-223** Use `preferredPriceRange`, concentration, and house tier as additional ranking signals in the wishlist-overlap and recommended-trader queries

### 3D — Sanity Blog (Behind the Bottle)

- [ ] **IMP-230** Install `@sanity/client` and `next-sanity`; configure Sanity project and dataset; store API token in env
- [ ] **IMP-231** Define Sanity schema: `article` document type with `title`, `slug`, `publishedAt`, `author`, `body` (Portable Text), `coverImage`, `perfumeRefs` (array of references to perfume slugs), `houseRefs` (array of references to house slugs), `tags`
- [ ] **IMP-232** Replace [`app/behind-the-bottle/page.tsx`](../app/behind-the-bottle/page.tsx) redirect with a real article index page; fetch via GROQ with ISR (revalidate: 3600)
- [ ] **IMP-233** Build `app/behind-the-bottle/[slug]/page.tsx` article detail page; render Portable Text with `@portabletext/react`
- [ ] **IMP-234** Cross-link articles: on `/perfume/[slug]` show a "From the blog" section querying articles with `perfumeRefs[]` containing that slug
- [ ] **IMP-235** Cross-link articles: on `/houses/[slug]` show related articles via `houseRefs[]`
- [ ] **IMP-236** Add JSON-LD `Article` schema to article detail pages; add OG image from Sanity image pipeline

### 3E — SEO Pass

- [ ] **IMP-240** Add JSON-LD `Product`/`Thing` structured data to `/perfume/[slug]` pages (name, description, image, brand)
- [ ] **IMP-241** Add JSON-LD `Organization` to `/houses/[slug]` pages (name, country, foundingDate, url)
- [ ] **IMP-242** Add `<meta name="description">` and Open Graph tags (`og:title`, `og:description`, `og:image`) to all perfume, house, and exchange pages
- [ ] **IMP-243** Generate dynamic OG images for perfume pages (bottle image + name + house)
- [ ] **IMP-244** Add canonical URL tags to all pages; verify no duplicate content from filter params
- [ ] **IMP-245** Submit XML sitemap including all perfume, house, and article slugs; verify in Google Search Console
- [ ] **IMP-246** Add `prefers-reduced-motion` gate to existing GSAP hero animation in [`app/home-client.tsx`](../app/home-client.tsx)

### 3F — Bulk Inventory Editor

- [ ] **IMP-250** Build multi-row inventory grid: add multiple `UserPerfume` rows in one session with inline search for perfume name
- [ ] **IMP-251** Build CSV import: accept a `.csv` file with columns `perfumeName`, `house`, `mlRemaining`, `condition`, `tradePreference`
- [ ] **IMP-252** Fuzzy-match each CSV row against existing catalog (perfume name + house); bucket results: confident (green) / uncertain (yellow) / no match (red)
- [ ] **IMP-253** Build 3-step import review screen: confirm confident matches, pick suggestions for uncertain rows, decide to skip or "Submit to catalog" for unmatched rows
- [ ] **IMP-254** "Submit to catalog" for unmatched rows calls existing `createPendingSubmission`; creates `UserPerfume` row in draft state with `pendingSubmissionId`; activates automatically when admin approves
- [ ] **IMP-255** Build Fragrantica profile import: parse a Fragrantica collection page URL (user provides); scrape owned fragrances via the existing scraper infrastructure; run through the same fuzzy-match and review flow as CSV
- [ ] **IMP-256** Add "My Wardrobe" (all owned, private) vs "My Listings" (available, exchange-visible) view split in the user's inventory page

### 3G — Shareable Links and Social

- [ ] **IMP-260** Add public/private toggle to `UserPerfumeWishlist`; generate a clean shareable URL `/wishlist/[userId]`
- [ ] **IMP-261** Add shareable link to trade proposals: `/trades/[tradeId]` visible only to participants (and admin); useful for referencing in DMs off-platform
- [ ] **IMP-262** Add "Copy link" button to trader profile and wishlist pages for sharing on Reddit and Discord
- [ ] **IMP-263** Add community stats strip to the home page: "X bottles listed · X trades completed this month · X members" — aggregate DB counts, cached and updated every hour

### 3H — Experience Polish

- [ ] **IMP-270** Extend View Transitions from [`LinkCard`](../components/Organisms/LinkCard/LinkCard.tsx) to the trade timeline and compare page navigation
- [ ] **IMP-271** Add GSAP stagger animation to exchange grid load and the "Just listed" activity feed
- [ ] **IMP-272** Add mobile bottom navigation bar optimised for thumb reach (exchange, messages, profile, alerts)
- [ ] **IMP-273** Add i18n strings for all new trade states, condition labels, and alert types via `next-intl`
- [ ] **IMP-274** Add "Recently active" indicator (last seen within 7 days) on trader profiles and inbox rows so traders know they'll get a response
- [ ] **IMP-275** Add keyboard shortcut `/` to focus exchange search; `Esc` to clear filters

---

## Future Roadmap _(noted, not in current scope)_

- **IMP-F01 — Decant splits:** `DecantSplit` + `DecantSplitSlot` models; one host ships to multiple claimants simultaneously; slot claim flow; organiser dashboard. Hold until core trade lifecycle is stable.
- **IMP-F02 — Follow system:** follow traders, houses, or reviewers; lightweight feed of followed activity (ties into `CF-050`–`CF-052` in the customer backlog).
- **IMP-F03 — "Scent journey" timeline:** chronological record of a user's trades, reviews, and collection changes on their public profile.
- **IMP-F04 — Real-time messaging:** upgrade ThreadClient from 15s polling to SSE or WebSocket for truly live chat.
- **IMP-F05 — Saved searches:** save current filter state with an alert rule that notifies when new listings match (ties into `CF-020`–`CF-023`).
- **IMP-F06 — Trade templates:** save a frequently used swap offer configuration (e.g. "always offer my 10ml sample in exchange") to speed up the compose flow.

---

## Notes

- **Completed (Wave 1):** 1A schema, 1B admin strikes + ban enforcement, 1C user reports + admin reports queue, 1D listing photos, 1E trader avatar + profile fields (region, social links). IMP-031 (report from trade timeline) and IMP-051 trade-timeline avatars wait on 2A trade UI.
- All schema changes use `prisma db push` — no migration files.
- After schema changes: `npm run db:generate` and restart `npm run dev` (or delete `.next` + `node_modules/.prisma/client` if the client is stale on Windows).
- All new authenticated API routes mirror the auth, CSRF, and rate-limit patterns in [`app/api/contact-trader/route.ts`](../app/api/contact-trader/route.ts).
- New test coverage follows [`app/api/contact-trader/route.test.ts`](../app/api/contact-trader/route.test.ts) style.
- Any `price`/`tradePrice` fields shown in UI are framed as optional, non-binding hints for off-platform discussion — never as amounts the site will charge.
