# Homepage: “E — The Gallery Walk”

Implementation contract for adapting the Perfumer’s Hollow homepage to the supplied reference. This is a layout and composition change, not a data-model redesign. The homepage must render real application data and retain existing global behavior.

## Guardrails

- Keep Cormorant Garamond for headings and Inter for body text via `app/layout.tsx`.
- Keep the existing Noir tokens and decorative `noir-border` convention. Add homepage-scoped styles or component classes only; do not change global `h1`–`h3`, `.inner-container`, or shared card behavior to force the mockup.
- Keep authentication, dynamic signup availability, localization, compare controls, ad eligibility, desktop navigation, both mobile navigations, and the global footer.
- Keep the homepage search limited to perfume and house typeahead results. Do not add Exchange or collector search.
- Use real listings, shelves, articles, and seasonal votes. Do not add mock reviews, statistics, listing details, or membership claims.
- Preserve empty states and feature/configuration gates. A missing data source must hide or honestly label a section, not generate placeholder records.
- No database migration is required: all planned content is available from current Prisma and Sanity fields. If implementation later uncovers a genuine data requirement, stop and reassess before changing the schema.
- Keep server reads in server modules/pages and interactive presentation in client components.

## Page composition contract

The desktop page follows the order below. Responsive layouts should stack naturally, retain touch targets, and allow compact horizontal sections to scroll. Existing fixed mobile navigation and compare-tray padding must continue to work.

### 1. Existing global navigation

- Continue rendering `GlobalNavigation`, `MobileNavigation`, and `MobileBottomNavigation` from `app/layout.tsx`; do not create homepage-only copies.
- Preserve the real main links from `data/navigation.ts`: Archive, Houses, Journal, Community, and Exchange.
- Preserve locale switching, Exchange-new badge, alert bell, profile/admin menus, sign-in, and the availability-aware join CTA.
- The reference’s “Join Free” wording is illustrative. The repository’s signup availability provider remains authoritative.

### 2. Hero with left-aligned title, tagline, description, and existing perfume/house search

- Recompose `app/home-client.tsx` into a bounded hero under the global header, using `/images/new/home.webp`.
- Place the localized title, tagline, and description in a left-aligned content block.
- Retain the shared `Select` atom and `SearchBar` organism. Supported modes remain exactly:
  - `perfume` → `/api/perfume` → `/perfume/[slug]`
  - `perfume-house` → `/api/perfume-houses` → `/houses/[slug]`
- Keep typeahead behavior, pending-review badges, keyboard behavior, and real result navigation.
- Do not add a non-functional Search button merely to match the reference.
- Retain reduced-motion handling if hero animation remains.

Exact data:

- `heading: string` from `home.heading`
- `subheading: string` from `home.subheading`
- localized description from `home.description`
- local client state `searchType: "perfume" | "perfume-house"`

Implemented in `components/Containers/Home/HomeHero.tsx`:

- Desktop content area is ~384px below the fixed header (`lg:min-h-[24rem]`) inside the shared 1280px container; copy column is `lg:w-[52%]`.
- Heading `clamp(56px, 5.5vw, 80px)` desktop (79px at 1440, one line) / 44–60px mobile (two lines), tagline 34px desktop / 26px mobile, body 21px desktop / 16px mobile Inter. Sizes were matched to the reference by scaling its text widths to the 1200px container. The heading sizes use `!` utilities because the unlayered global `h1` rule in `globals.css` otherwise wins over Tailwind utilities.
- Search row (selector + input) is capped at 640px, each control at least 48px tall; controls stack below `sm`.
- Placeholders (`home.galleryWalk.hero.placeholder.*`) and the hint (`home.galleryWalk.hero.searchHint`) describe the real scope: perfume or house name search in the Archive.
- Header clearance is applied once by the hero (`--spacing-site-header-*`), and dropped when `OnboardingBannerSlot` (`data-onboarding-banner`) already supplied it.
- Typeahead results render in a portal with `fixed` positioning, so the hero image layer can clip (`overflow-hidden`) without cutting off suggestions.
- Real community statistics stay in the hero below search. The founding-spots banner moved to a compact strip at the bottom of the page (see “Final section behavior”), so search is not interrupted.

Asset: `/images/new/home.webp` (rainy noir street, “Good Scents” storefront on the right) is used with a warm sepia filter and left-to-right overlay. It is monochrome, so it reads cooler than the amber reference. **A clean warm-toned rainy-street WebP (≈1920×1080, subject weighted right, no baked-in text) is needed for closer fidelity.** Do not use the mockup render as a background.

### 3. Three compact pathways: Archive, Exchange, Community

- Render three compact, accessible pathway links immediately after the hero.
- Targets:
  - Archive: `THE_ARCHIVE_PATH` (`/the-archive`)
  - Exchange: `/the-exchange` (promote to a route constant during implementation)
  - Community: `/community` (add/reuse a route constant)
- Copy must be localized and describe existing functionality only.
- Reuse `PrefetchLink`, shared icon conventions, and Noir borders. These are navigation cards, not statistics cards.

Implemented in `components/Containers/Home/HomePathways.tsx` as a `nav` landmark list: three equal columns with thin gold vertical separators on `md+`, stacked rows with horizontal separators on mobile, gold-outlined circular `react-icons/fa6` icons, and route constants `THE_ARCHIVE_PATH`, `THE_EXCHANGE_PATH`, `COMMUNITY_PATH`. Pathway titles are link labels, not headings, so the page keeps one `h1` followed by section `h2`s.

Exact data per pathway:

- stable key
- localized title
- localized description
- route
- decorative icon

### 4. Latest on the Exchange: four individual listing cards

- Fetch the four most recent available listings and present each as one listing. Do not collapse several users’ listings into a perfume-level card.
- Keep the server-side eligibility rule in `models/activity-feed.server.ts`: `available != "0"` and trader is not banned.
- Each card links to the real perfume and trader routes and uses the listing’s uploaded primary image with catalog-image fallback.
- Listing labels must come from stored listing fields. If a field is absent, omit it.
- The existing `ActivityFeedSection`/`ActivityFeedItem` are reusable behavior references, but their compact row treatment does not match the reference’s four image-led cards. `ExchangePerfumeCard` and `LinkCard` are perfume-aggregation/square catalog cards and should not be forced into individual-listing semantics.
- Preserve compare behavior by rendering the existing `PerfumeCompareToggle` for the card’s perfume, or by extracting a reusable card composition that still uses that control.
- Keep ad eligibility (`shouldShowAds`) and render an eligible ad in a non-disruptive homepage slot; ads must not masquerade as listings.
- Followed activity remains real functionality. It renders as its own compact `ActivityFeedSection` below the listing grid; never mix followed trades/reviews/articles into the four listing cards.

Implementation (no schema change):

- `models/home-listings.server.ts` → `getCachedHomeLatestListings()` returns up to four `HomeListing` DTOs (`types/home-listing.ts`). It reuses `availableListingWhere` and the `exchange-new-week` tag / 120s window from `models/activity-feed.server.ts`; `ActivityFeedListingRow` is unchanged.
- Selected fields: `id`, `createdAt`, `images`, `available`, `type`, `condition`, `decantFormat`, `tradePreference`, `tradeOnly`, `perfume { id, name, slug, image, perfumeHouse.name }`, `user { id, username, firstName, lastName, avatarImage }`.
- The trader display name is computed on the server with `getTraderDisplayName` (no email selected); the DTO only carries `trader.id`, `trader.displayName`, `trader.avatarImage`.
- Size shown is `available` (ml listed for sale, same as `ExchangeListingRow`) and only when it parses as a positive number. `amount` (full-bottle inventory count) and `mlRemaining` are not shown as listing size.
- Cards: `HomeListingCard` (image with catalog fallback, `ListingImageBadges`, `getPerfumeTypeLabel`, `listing.decantFormat.*`, `TraderAvatar`, `PerfumeCompareToggle` as a sibling of links). No individual listing route exists, so the perfume name/image go to `/perfume/[slug]` and the trader row goes to `/trader-profile/[id]` (the trader's items).
- Grid: 1 column → 2 at `sm` → 4 at `min-[75rem]` (1200px; a rem value so Tailwind orders it after `sm`). Zero listings render a compact empty state with an Exchange link. Followed activity (signed-in viewers) stays below the grid inside this section.

### 5. Public Trays: large image left, text and CTA right

- Use `/images/new/public-trays.webp` as the existing promotional image.
- Link the CTA to `/community/shelves`.
- Respect `featureFlags.communityShelves`. If disabled, omit the CTA section or present an honest unavailable state; do not promise accessible trays.
- The reference can be implemented as an editorial promo without querying shelf records. If real shelf previews are added later, reuse `listPublicShelves()` from `models/community.server.ts`.
- Implemented in `HomePublicTraysFeature`: `app/page.tsx` reads the flag via `isFeatureEnabled("communityShelves")` and passes a boolean; disabled renders nothing. Desktop is a 55/45 grid (`md:grid-cols-[55fr_45fr]`, min 280px) inside `noir-border`; mobile stacks the image at its natural ratio above the charcoal text panel. Copy: `home.galleryWalk.publicTrays.{title,description,details,cta}`. Image is lazy with column-based `sizes`.

Exact data for the promo:

- localized heading
- localized description
- localized CTA
- route `/community/shelves`
- image `/images/new/public-trays.webp`
- `communityShelves` feature-flag state

Optional real preview fields already returned by `listPublicShelves()`:

- shelf `id`, `name`, `description`, `updatedAt`
- collector `id`, `username`, `firstName`, `lastName`
- `_count.items`
- up to four item perfumes: `id`, `name`, `slug`, `image`

### 6. From the Journal: three article cards

- Fetch the latest three localized published articles with `getLatestPublishedArticles(3)` (`latestArticlesQuery`, GROQ slice `[0...$limit]`, same `articles` / `articles:{locale}` tags and English fallback as the index). `app/page.tsx` calls `getLatestPublishedArticlesOrEmpty(3)`, which logs Sanity/locale failures and returns `[]`, so the page renders without the section.
- `ArticleCard variant="home"` is the homepage card (h3 title, 16:10 image, 3-line excerpt, date · author pinned to the bottom, no tags); the default and featured variants used by Journal pages are unchanged. Grid is one column, then three from `md`. Two columns were skipped because three items would leave an orphan card.
- Keep Sanity locale fallback behavior and published-date filtering.
- If Sanity is not configured or no articles exist, omit the section. Do not invent articles.
- Link the section CTA to `JOURNAL_PATH`.

Exact article fields already supplied by `ArticleListItem`:

- `_id`
- `title`
- `slug`
- `publishedAt`
- `author`
- `excerpt`
- `coverImage` including `alt`
- optional `featured`, `language`, and `tags`

The reference shows reading times; the current article schema/query does not provide reading time. Omit it unless a real value is later computed from article body. The index query currently does not fetch `body`.

### 7. Seasonal Trending: compact horizontal ranked strip

- Reuse `SeasonalTrendingSection` and its real `getCachedSeasonalTrendingPerfumes()` result.
- Adapt or add a homepage/gallery variant so the section reads as a compact ranked strip at the bottom of the content.
- Preserve links to perfume detail pages and horizontal scrolling on narrow screens.

Implemented: `variant="compact"` (homepage only; the Exchange uses `sidebar`, whose markup and classes are unchanged). Placed after the Journal, before the footer, inside a bordered burgundy strip. Each item is an `<ol>` entry linking to `/perfume/[slug]` with serif rank, 48px bottle thumbnail (`object-contain`), name (2-line clamp), and house; vote counts are omitted here and kept in the sidebar. Items are 220px wide and scroll horizontally with snap; from `xl` each takes a fifth of the strip so about five are visible. There is no “view all” link because no seasonal index route exists. With no votes for the current season the whole strip is omitted.

Exact fields already available:

- `season`
- per perfume: `perfumeId`, `voteCount`, `name`, `slug`, `image`
- house: `id`, `name`, `slug`

### 8. Existing global footer

- Continue using `SiteFooter` from `app/layout.tsx`; do not render another footer inside the homepage.
- Preserve localized copyright/policy links and real catalog statistics.
- The reference’s social icons and “Collector Standards” label do not map directly to current footer functionality and must not be fabricated.

## Final section behavior

| Section | Shows when | Collapses when |
| --- | --- | --- |
| Hero + search + community stats | Always | — |
| Pathways | Always | — |
| Latest on the Exchange | Always (compact empty state + Exchange link at zero listings) | — |
| Followed activity (inside the Exchange section) | Signed in and following people/houses/perfumes with activity in the last 30 days | Guest, or no followed activity |
| Display ad | `shouldShowAds(user)` and AdSense configured | Otherwise renders nothing (no reserved space) |
| Public Trays | `communityShelves` flag on | Flag off |
| From the Journal | Sanity configured and ≥1 published article (locale, then English) | Unconfigured, zero articles, or fetch failure (logged) |
| Seasonal Trending | Current season has votes | No votes |
| Founding-spots strip | Guest and free founding spots remain (`useJoinCta().freeOpen`) | Signed in, or signup is paid/closed/full |

Spacing: every section owns its own `py-5 lg:py-6` (40px between sections on mobile, 48px on desktop; section header to grid 16px; card gaps 16px, 20px at 1200px+); collapsed sections render nothing (the founding-strip wrapper has horizontal padding only), so no empty gaps remain.

Account states:

- Guest: no hero interruption. The founding invitation is the existing `FoundingSpotsBanner` (copy `join.bannerOpen`, CTA from `useJoinCta`), placed as the last strip before the footer. It disappears automatically when the free window is closed or full; no other membership claims are shown.
- Signed in: no signup invitations. Followed activity comes from `getFollowedActivity(viewerId)`, an uncached per-request query, rendered as a secondary `ActivityFeedSection` below the four listing cards.
- Caching: listings (`exchange-new-week`), seasonal results (`perfume`), and Journal (`articles`) caches hold public, viewer-independent data only. Session, followed activity, ad eligibility, and guest state are resolved per request; the page reads cookies, so it renders dynamically.

## Reusable components and services

- `GlobalNavigation`, `MobileNavigation`, `MobileBottomNavigation`, `SiteFooter`
- `Select`, `SearchBar`, `SearchTypeahead`
- `PrefetchLink`, `VooDooLink`
- `PerfumeCompareToggle`
- `AdSenseUnit`
- `DeferredBelowFold`
- `ArticleCard`
- `SeasonalTrendingSection`
- `ActivityFeedItem` as a source for listing image/trader/time semantics
- `TraderAvatar`, `ListingImageBadges`
- `getPrimaryListingImage`, `normalizeRemoteImageSrc`, `getTraderDisplayName`
- `getCachedRecentlyListedActivity`
- `getCachedSeasonalTrendingPerfumes`
- `getPublishedArticles`
- `listPublicShelves`
- `shouldShowAds`, `isFeatureEnabled`

`LinkCard` and `ExchangePerfumeCard` remain useful for catalog/perfume-level grids, but their current square, aggregated perfume semantics are not a direct fit for the required individual listing cards.

## Proposed new components

Names may be adjusted to nearby conventions, but responsibilities should remain narrow:

- `components/Containers/Home/GalleryWalkHero.tsx` — hero copy and existing search controls.
- `components/Containers/Home/HomePathways.tsx` — Archive/Exchange/Community links.
- `components/Containers/Home/LatestExchangeSection.tsx` — section heading, four-listing grid, and “view all” link.
- `components/Molecules/HomeExchangeListingCard.tsx` — one real listing with photo, perfume/house, trader, listing attributes, date, and compare control.
- `components/Containers/Home/PublicTraysPromo.tsx` — feature-gated image/text CTA composition.
- `components/Containers/Home/JournalPreviewSection.tsx` — three localized article cards and Journal link.

Prefer extending `ArticleCard` and `SeasonalTrendingSection` with explicit variants over duplicating their semantics.

## Mockup and current-functionality mismatches

- Mockup search appears to offer a broad combined placeholder (“perfumes, houses, notes, or collectors”) and a submit button. Current search is a real perfume-or-house name typeahead; the hero uses scoped placeholders and no submit button. No notes, Exchange, or collector search was added.
- Mockup pathway copy (“Buy, sell, and trade within a trusted community”, “Collectors, discussions…”) implies features or assurances the site doesn't make; the localized descriptions describe listings, trays, wear journals, and challenges instead.
- Mockup hero image is warm amber; the available `home.webp` is monochrome (see asset note above).
- Mockup listing cards include specific bottle sizes and action labels (“Bottle”, “Decant”, “Partial”). Cards show only stored values: listed ml, perfume type, decant format, condition, and trade preference; there is no per-card action label.
- The current activity feed is a compact horizontal row and can include a separate followed-activity feed. The required section is four individual newest listings only.
- `ExchangePerfumeCard` groups listings by perfume, while the reference depicts one listing/trader per card.
- Mockup Public Trays is promotional. The application has a feature-gated `/community/shelves` route and real shelf data, so the CTA must honor that flag.
- Mockup article cards show reading time. Current Sanity list data has no reading-time field and no body from which to compute it.
- Journal redirects when Sanity is unconfigured; the homepage Journal section must therefore be conditional.
- Mockup seasonal labels do not show vote totals; the homepage strip omits them, and the Exchange sidebar keeps them.
- Mockup footer includes social links not present in the existing footer.
- Mockup desktop navigation labels/structure differ from the application’s localized global navigation and availability-aware signup controls.
- Community statistics and the founding-spots banner are real but absent from the reference. Stats stay as a small line under hero search; the banner is a guest-only strip before the footer.

## Implementation checklist

- [x] Add all new homepage copy to `messages/en.json`.
- [x] Run the translation sync workflow for `es`, `fr`, and `it`; validate placeholders.
- [x] Add/reuse constants for Exchange, Community, and Public Trays routes.
- [x] Add a dedicated homepage listing query/DTO with only the public fields the card needs (no email).
- [x] Fetch four recent listings, three localized articles, seasonal results, session state, ad eligibility, and the Public Trays feature state on the server.
- [x] Recompose the homepage in the required eight-section order.
- [x] Keep the existing perfume/house typeahead APIs and navigation.
- [x] Add scoped hero/pathway/listing/promo/article/seasonal components.
- [x] Preserve compare controls and trader/perfume links.
- [x] Preserve ads without presenting them as content cards.
- [x] Preserve desktop and mobile global navigation and fixed-bottom spacing.
- [x] Handle empty listings, disabled trays, unavailable Sanity, missing images, and empty seasonal results honestly.
- [x] Verify responsive behavior, keyboard navigation, focus states, heading hierarchy, alt text, reduced motion, and horizontal-scroll affordances (see “Verification findings”; live `:focus-visible` rendering could not be observed in the automated browser).
- [x] Confirm no global heading/container regression on non-home pages: no global heading/container rules changed (homepage uses scoped `!` utilities); `ArticleCard` default/featured and `SeasonalTrendingSection` sidebar markup are unchanged; `/the-archive` spot-checked. The only global CSS change is the reduced-motion view-transition rule below.
- [x] Run focused component tests. Note: vitest fails to load `postcss.config.mjs` (tuple plugin syntax), so tests were run with PostCSS disabled.
- [x] Run the full repository checks below (results and blocked steps in “Verification findings”).
- [ ] Review the final homepage against the reference at desktop and mobile widths.
  - [x] Hero, pathways, Latest, Public Trays, and Journal reviewed at 1440, 1024, 390, and 320px.
  - [ ] Seasonal strip visual review once the current season has votes (layout covered by component test; no votes exist locally).
  - [ ] Journal with three articles (only one is published locally).
  - [ ] Signed-in and signup-closed states in a browser.
  - [ ] Replace `home.webp` with a warm rainy-street asset when available.

## Verification findings (2026-10-17)

Local dev server (`next dev`, Turbopack), English unless noted, guest session, AdSense disabled in `.env.local`.

### Commands

| Command | Result |
| --- | --- |
| `npm run lint` | Pass (whole repo). Homepage files re-linted after the last edits: pass. |
| `npm run typecheck` (`tsc`) | Pass. |
| `npm run build` | Blocked at its first step: `prisma generate` hit `EPERM` renaming `query_engine-windows.dll.node` because the running dev server holds the engine. The schema is unchanged, so the remaining steps were run directly: `tsc` pass, `next build` pass with no warnings; `/` is dynamic (`ƒ`). |
| `npm run test` | Blocked: Vite cannot load `postcss.config.mjs` (`Invalid PostCSS Plugin found at: plugins[1]`). Pre-existing; not changed here. |
| Vitest with PostCSS disabled (temporary config, removed afterwards) | Homepage tests: 5 files / 23 tests pass. Full suite: 15 files / 80 tests fail, 1479 pass. The same 15 files fail on the unmodified tree (81 failures, tracked changes stashed), so none are caused by this work (auth actions, API routes, scraper, `compare-ids`, `TagSearch`, `PopOver`, `AlphabeticalNav`, `ChangePasswordForm`, `TraderFeedbackSection`). |
| `npm run i18n:diff` | Pass (es/fr/it in sync). |
| `npm run test:e2e`, `npm run knip` | Not run. |

New targeted tests (behavior, not markup):

- `models/home-listings.server.test.ts` — up to four visible listings newest first, no private trader fields selected, rows mapped to the public DTO (server-side display name, missing house kept as `null`), `createdAt` rehydrated after caching.
- `lib/sanity/articles.server.test.ts` — bounded latest query, locale → English fallback, unconfigured Sanity, and `getLatestPublishedArticlesOrEmpty` returning `[]` when Sanity or locale resolution throws.
- `HomePublicTraysFeature.test.tsx` — `communityShelves` flag on by default and off with `"false"`; disabled renders nothing; enabled links to `/community/shelves`.
- `HomeListingCard.test.tsx` — perfume/trader destinations, compare button not inside a link, catalog-image fallback, invalid/missing optional fields omitted.
- `SeasonalTrendingSection.test.tsx` — compact variant is a ranked list of perfume links without vote counts; the sidebar keeps vote counts; empty results render nothing.

### Browser checks

| Check | 1440 | 1024 | 390 | 320 |
| --- | --- | --- | --- | --- |
| Horizontal page overflow | none | none | none | none |
| Header bottom → `h1` top | 108 → 182px | 152 → 191px | 90 → 120px | clear |
| `h1` size | 79.2px | 56.3px | 50.7px | 44px |
| Shared left edge (all sections) | 113px | 40px | 20px | 20px |
| Listing columns | 4 × 282px | 2 × 454.5px | 1 | 1 |
| Journal columns | 3 | 3 | 1 | 1 |
| Public Trays | 55/45, 350px tall (min 280px) | 506 / 414px | stacked | stacked |

- Section order (DOM and visual): global nav → hero → pathways → Latest → Public Trays → Journal → (seasonal, omitted: no votes) → founding strip → footer. One `h1`, section `h2`s, card `h3`s.
- Mobile: fixed bottom navigation (70px) present; footer content clears it.
- Hero: copy readable over the overlay at all widths; image crop `object-position: 72% 50%` keeps the storefront on the right. `home.webp` is the only preloaded/eager image; listing, trays, and Journal images are `loading="lazy"`.
- Search: perfume scope returns `/perfume/[slug]` options, house scope returns `/houses/[slug]`; ArrowDown moves `aria-activedescendant` while focus stays in the input; Escape closes the list.
- Listings: perfume title/image → `/perfume/[slug]`, trader row → `/trader-profile/[id]`; compare is a sibling button (not nested in a link) and toggles without navigating. Missing images and invalid optional fields are covered by unit tests (all four local listings have photos).
- Translated wrapping: es, fr, and it at 320px — no overflow or clipped text.
- Ads: eligibility path unchanged (`shouldShowAds` → `AdSenseUnit` between Latest and Public Trays); AdSense is disabled locally, so no unit rendered and no space was reserved.
- Reduced motion: with `prefers-reduced-motion: reduce`, no element on the page has a transition or animation longer than 1ms, and client navigation works.
- Focus: the automated browser tab has no OS focus, so `:focus-visible` never matched and rings could not be observed. By code: the "View all" links, card titles, trader links, pathway cards, and Journal cards use a 2px gold `focus-visible` outline; search uses a gold ring; shared `Button`/`VooDooLink` (compare, Public Trays CTA) keep the browser default ring, as elsewhere on the site.

### Fixed during verification

- **Reduced-motion crash (pre-existing, site-wide).** `ViewTransitionsWrapper` removed the `next-view-transitions` provider for reduced-motion users, but `PrefetchLink`, `VooDooLink`, and other links use its hooks, so focusing or hovering a link threw `useSetFinishViewTransition must be used within a ViewTransitions component` and replaced the page with "Application error". The provider is now always mounted and `globals.css` disables `::view-transition-*` animations under `prefers-reduced-motion: reduce`.
- Pathway cards and listing trader links gained the same gold `focus-visible` outline as the other homepage links.
- Listing images are no longer preloaded; only the hero image is prioritized.

### Not verified in the browser

- Signed-in view and followed activity (no test credentials); logic is server-side and uncached per request.
- Signup closed/full: the founding strip depends on `useJoinCta().freeOpen`; not toggled locally.
- Public Trays disabled: needs an env change and server restart; covered by unit test.
- Zero and three Journal articles: one article exists; zero is covered by unit tests.
- Seasonal strip with data: no votes this season; covered by component test.
- Live focus-ring appearance (see Focus above).

### Pre-existing issues noticed (not changed)

- Search error message renders as the raw key `common.searchError`: the messages use `{{error}}`, which is not ICU syntax for next-intl. Seen once when the house search API took ~25s under load.
- Search input label "Search", listing trade badges ("Cash", "Trade"), and listing dates are English-only in other locales.
- Compare button `aria-label` ("Add to compare") does not include the perfume name, so four identical labels appear in the Latest grid.
- `CommunityStatsStrip` is not shown in the hero locally (stats below its display threshold); the footer shows real totals.

### Type scale (matched to E at 1440px)

Section `h2` 30px (Latest, Journal, Seasonal); Public Trays `h2` 60px with a 30px Cormorant lead line; pathway titles 24px over 15px text; listing titles 26px, house 16px, details 15px, trader/date 13px; Journal titles 24px, excerpts 16px, meta 13px. Body text stays Inter (the reference renders some body copy in a serif), so the listing house name is 16px rather than the serif-equivalent 18px.

### Remaining visual differences from E

- Hero image is the monochrome `home.webp` with a sepia treatment, not the warm amber street. Needs a warm rainy-street WebP (~1920×1080, subject right, no text).
- No reading times on Journal cards (no field or body in the list query).
- No social icons in the footer; navigation labels follow the existing localized global nav.
- Listing cards show stored facts only (ml listed, type, decant format, condition, trade preference); no "Bottle/Decant/Partial" action labels or invented sizes.
- Search uses scoped perfume/house placeholders and no submit button, rather than the mockup's combined "perfumes, houses, notes, or collectors" field.
- Community stats line and guest founding strip are real additions not in E.
- Seasonal strip and a full three-article Journal row still need visual review with real content.

## Verification commands

Current scripts from `package.json`:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Additional relevant checks:

```bash
npm run test:e2e
npm run knip
npm run i18n:diff
```

`npm run build` runs `prisma generate`, type checking, and `next build`. No migration command is part of this homepage work.
