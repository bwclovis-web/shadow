# Exchange redesign

Implementation contract for adapting The Exchange (`/the-exchange`) to the supplied desktop, tablet (~820px), and mobile mockups. This is a discovery layout and query-shape change, not a schema redesign. No migration is required unless a later step explicitly proves a data gap that cannot be expressed with existing `UserPerfume` / `Perfume` fields.

**Reference assets (illustrative only):**

- `C:\Users\bwclo\.cursor\projects\c-repos-shadow\assets\exchange-dt1-e2cd0876-04f9-4570-b438-acf39d5d34e7.jpg`
- `C:\Users\bwclo\.cursor\projects\c-repos-shadow\assets\exxchange-dt2-0d4bac6b-ade4-41ca-9b96-94784c65fe4c.jpg`
- `C:\Users\bwclo\.cursor\projects\c-repos-shadow\assets\exchange_tab-dcbe83d2-9024-4aac-8ced-94edddf2a8c4.jpg`
- `C:\Users\bwclo\.cursor\projects\c-repos-shadow\assets\exchange-mob-6a093cc1-b542-4c17-a157-e718a6e163ea.jpg`

---

## Reference priorities

When sources disagree, resolve in this order:

1. **Written contract (this document)** — wins for functionality, data, workflow, and guardrails.
2. **Actual codebase** — authoritative for routes, auth, visibility, trade/contact flows, ads, saved searches, galleries, and what fields exist.
3. **Mockups** — authoritative for layout below the hero, hierarchy, grid/list, filter drawer, and View collectors presentations.
4. **Current Exchange hero in the running app** — authoritative for banner height, crop, image, title position, overlays, and spacing (do not “improve” the hero from mockups).

Mockup fragrance names, counts, navigation labels, search placeholders, and imagery are illustrative. Never hardcode or fabricate them.

---

## WORKFLOW

- Implement **only** the explicitly requested step from the staged checklist below.
- Attached images and mockup descriptions **do not** authorize completing later steps.
- After each step: report (1) files changed, (2) checks run, (3) preview URL/route, (4) remaining limitations; then **STOP** for visual review.
- Do **not** push, merge, deploy, edit production data, or author/apply migrations for this redesign unless a later step explicitly requests a migrate-backed change (default: none).
- Preserve unrelated in-progress work; keep diffs scoped to Exchange redesign files and shared pieces only when a step requires extending them (prefer optional props over forks).

---

## DESIGN

- Preserve current hero height at **every** breakpoint, crop, image (`/images/new/exchange.webp`), title position, overlays, count child slot, and spacing.
- Do **not** modify shared `TitleBanner` or global `.title-banner` for this work.
- Preserve burgundy / gold / charcoal Noir theme, fonts, global navigation, and footer.
- Match reference ornamental gold corners via a **reusable** SVG and/or CSS utility (extend or complement existing `.noir-border`, which today only paints two L-corners). Do not fork one-off corner markup per card.
- Changes begin **below** the hero.
- Preserve real navigation from `data/navigation.ts` / existing nav components; do not copy mockup nav chrome.

---

## LAYOUT

Below the hero:

| Area | Contract |
| --- | --- |
| Toolbar | Search, sort, Filters control, grid/list toggle; trade preference shortcuts; applied filter chips |
| Filters | **No** permanent filter sidebar. Right modal drawer (desktop/tablet); nearly full-screen on mobile |
| Results grid | **3** columns desktop / **2** tablet / **1** mobile |
| List | Collapsed rows; at most one fragrance expanded for offers |
| Recent activity | Small section **below** results (relocate/reuse existing activity feed behavior; do not enlarge into a second discovery surface) |
| Empty inset | Mockup empty-state inset is an alternative presentation, **never** shown below a non-empty results list |

Secondary surfaces that exist today (wishlist matches, mutual swaps, palate recommendations, seasonal trending, ads, saved search) must remain available with correct auth/cache semantics. Relocate as needed when the sidebar is removed; do not drop them silently.

---

## DATA

| Rule | Detail |
| --- | --- |
| Grouping | One result group per fragrance |
| Page size | Initially **24** fragrance groups per page (same rationale as catalog: fills 1/2/3-column grids) |
| Previews | At most **3** attributed preview images per group |
| Offers | Fetch matching offers **on demand** only; initially **5** offers per page |
| Same-offer AND | Every selected **offer-level** criterion must match the **same** `UserPerfume` row |
| Shared eligibility | Group counts, preview selection, and offer queries share the same eligibility rules |
| Counts | Distinguish **offer count** from **distinct collector count** in DTOs and copy |
| Ordering | Server filter + sort **before** pagination; stable secondary key (e.g. perfume id) |
| Bounds | Bounded queries, narrow DTOs; no full-catalog downloads; no N+1 offer/reputation/photo fan-out |
| Preserve | Visibility rules, own-listing exclusion for actions/previews as today, authentication gates, cache isolation (public vs viewer-specific), ads, saved searches, comparison entry points if present, galleries/lightboxes, and cash/swap action semantics |

### Current baseline (code facts)

- Page: `app/the-exchange/page.tsx` — `PAGE_SIZE = 16`, `revalidate = 60`, URL `q` / `pg` + discovery params.
- Query: `getAvailablePerfumesForDecantingPaginated` in `models/perfume-exchange.server.ts` — perfume groups with nested in-stock listings; order `name: asc` only; eager nested `userPerfume` select (not on-demand).
- Listing filters: `utils/exchange-listing-filter.server.ts` — trade/condition/photos/region (+ bottle types via SQL id list) applied as nested `UserPerfume` where (same-row AND).
- Perfume-level filters: notes (any of selected), seasons (any), house (single id), perfume id, search name/house — via `buildExchangeDiscoveryWhereFragments`.
- `minRep` is applied **after** pagination in the page component today (eligibility/count bug relative to this contract; fix in the data step).
- Select today omits `amount` / `mlRemaining` / `decantFormat` even though `exchange-types` and photo tests mention some of them — fill indicators must only appear when a later step loads **valid** volume data.
- Photo helpers: `utils/exchange-listing-photos.ts` (`MOSAIC_THUMB_MAX = 3`). Fallback chain for display: seller upload → catalog image → neutral placeholder (align with `getPrimaryListingImage` / listing photo components).
- Actions: `TradeComposerModal` + `useTradeComposerModal` / `ExchangeListingPicker` / `ExchangeListingRow`; cash vs swap via `getTradeCtaLabelKey` / `isCashOnlyListing`.
- Rating bottle art: `components/Organisms/NoirRating/` (`PerfumeBottle`, `OverallBottle`, accents/gradients). Reuse artwork for offer-count affordances **without** changing perfume rating behavior.
- Catalog reuse targets: `CatalogToolbar` patterns, `CatalogFilterDrawer` (adapt mobile to nearly full-screen / right drawer per mockups), `FilterChipStrip`, `PaginationBar`, `DiscoveryFiltersPanel` field set, `useCatalogNavigation`-style URL pushes (`scroll: false`), atoms per `.cursor/rules/reuse-ui-components.mdc`.

---

## VIEW COLLECTORS

| Surface | Presentation |
| --- | --- |
| Grid (desktop/tablet) | Side panel |
| Grid (mobile) | Full-screen sheet |
| List | Inline expansion; **one** fragrance open at a time |
| Content | Same offer DTO + query for all presentations |
| Chrome | Preserve active filters and background scroll position when panel/sheet/expansion opens |
| Actions | Cash contact and swap use existing supported flows (`TradeComposerModal` / connect paths) |
| Safety | Revalidate availability and authorization at the action boundary (do not trust stale card DTOs alone) |

---

## ICONS / STATES

- Reuse NoirRating bottle SVG artwork for visual affordances next to offer counts; do **not** change rating scoring UI or persistence.
- Fill indicators belong to **individual offers only**, and only when `mlRemaining` and capacity (`amount` or equivalent) or an explicit percentage are valid numbers. **Never** infer fill from condition, community rating, or ambiguous quantity strings.
- Missing image: seller → catalog → neutral placeholder.
- Distinct UX for: zero matches (filters/search), no inventory (empty exchange), and request failure (retry; optionally show previous results if still held).
- **Step 7:** add a temporary empty-state illustration slot (placeholder OK).
- Empty-state mockup inset is an alternative, never stacked under real results.

---

## Architecture (target)

URL-driven, server-rendered fragrance groups (same overall pattern as Archive/Houses and today’s Exchange discovery params). Client builds hrefs / calls `router.push(..., { scroll: false })`; offer pages load via a thin authenticated-aware API + client query when View collectors opens or a list row expands.

| Concern | Location |
| --- | --- |
| Page | `app/the-exchange/page.tsx` |
| Client shell | `app/the-exchange/TheExchangeClient.tsx` (evolve; split if file grows) |
| Toolbar | `components/Containers/Exchange/ExchangeDiscoveryToolbar.tsx` |
| Types / chips | `app/the-exchange/exchange-types.ts`, `buildExchangeDiscoveryChipItems.ts` |
| Group query | `models/perfume-exchange-groups.server.ts` (`getExchangeFragranceGroupsPage`) |
| Legacy exchange queries | `models/perfume-exchange.server.ts` (fragments; non-paginated helper) |
| Listing eligibility | `utils/exchange-listing-filter.server.ts` (+ tests); shared via `resolveExchangeEligibility` |
| DTOs | `types/exchange-discovery.ts` |
| Card adapter | `utils/exchange-group-card.ts` |
| Photos / previews | `utils/exchange-listing-photos.ts` (`MOSAIC_THUMB_MAX = 3`) |
| Offer page API | `app/api/exchange/offers/route.ts` → `getExchangeMatchingOffersPage` |
| Client fetch | `lib/queries/exchange-offers.ts` |
| Filter UI | Reuse `DiscoveryFiltersPanel` inside adapted drawer |
| Cards / list / panel | New or evolved Exchange molecules under `components/Molecules/` / `components/Containers/Exchange/` |

Prisma remains in `models/*.server.ts` per `docs/architecture.md` and `.cursor/rules/server-layers.mdc`.

### URL contract (proposed)

Keep existing discovery keys from `utils/discovery-filters.ts` (`DISCOVERY_QUERY`). Add:

| Key | Values | Notes |
| --- | --- | --- |
| `q` | search string | Existing |
| `pg` | 1-based page | Existing; page size 24 |
| `sort` | TBD in data step (e.g. `offers-newest`, `name-asc`) | Must be server-applied; stable tie-break |
| `view` | `grid` (default), `list` | Omit default from URL |

Defaults omitted from generated URLs. Invalid values fall back; page past end clamps on the server (catalog pattern).

Trade shortcuts map to existing `tradePref` tokens (`cash` / `trade` / `both`), not new query keys, unless a step documents otherwise.

---

## Component / file map

### Keep / extend (primary)

| File | Role in redesign |
| --- | --- |
| `app/the-exchange/page.tsx` | Server loader; group DTO; ads/session; no hero changes |
| `app/the-exchange/TheExchangeClient.tsx` | Layout below hero; toolbar; results; collectors host |
| `app/the-exchange/exchange-types.ts` | Narrow group + offer DTOs; offer vs collector counts |
| `app/the-exchange/buildExchangeDiscoveryChipItems.ts` | Applied chips |
| `models/perfume-exchange.server.ts` | Group query, eligibility, sorting, pagination |
| `utils/exchange-listing-filter.server.ts` | Same-offer listing predicates |
| `utils/exchange-listing-photos.ts` | ≤3 attributed previews; fallbacks |
| `utils/discovery-filters.ts` | URL parse/serialize (extend if sort/view live here or parallel `exchange-params`) |
| `components/Organisms/DiscoveryFiltersPanel` | Filter fields inside drawer |
| `components/Organisms/CatalogFilterDrawer` | Base drawer a11y; adapt sizing/side for Exchange |
| `components/Organisms/CatalogToolbar` | Pattern reference; Exchange may wrap or specialize (search + sort + filters + view) |
| `components/Molecules/FilterChipStrip` | Applied chips |
| `components/Molecules/SaveSearchButton` | Preserve |
| `components/Molecules/PaginationBar` | Preserve |
| `components/Molecules/ExchangePerfumeCard` / `ExchangeCardPhotos` / `ExchangeMultiListingPhotos` | Evolve or replace for group card mosaic |
| `components/Molecules/ExchangeListingRow` / `ExchangeListingPicker` | Offer rows / picker semantics |
| `components/Containers/Trade/TradeComposerModal` | Cash/swap actions |
| `components/Containers/Exchange/ActivityFeedSection` | Recent activity below results |
| `components/Organisms/NoirRating/*` | Bottle SVG reuse only |
| `components/Organisms/TitleBanner` | **Do not modify** |
| `app/globals.css` `.title-banner` | **Do not modify**; ornamental utility may extend `.noir-border` carefully |

### Likely new (names indicative)

| Piece | Purpose |
| --- | --- |
| Exchange toolbar | Search/sort/Filters/view + trade shortcuts |
| Exchange fragrance group card / row | Grid and list presentations |
| View collectors panel / sheet | Shared offer list host |
| Offer page model + API + `lib/queries` | On-demand offers (5/page) |
| Ornamental corners atom/utility | Reusable four-corner gold treatment |
| Empty-state block | Distinct zero-match / no-inventory / error + Step 7 illustration slot |

### Tests to update / add

| File | Focus |
| --- | --- |
| `models/perfume-exchange-discovery.server.test.ts` | Fragments + eligibility + pagination/sort |
| `utils/exchange-listing-filter.server.test.ts` | Same-offer AND |
| `utils/exchange-listing-photos.test.ts` | Cap 3; attribution; fallbacks |
| `app/the-exchange/buildExchangeDiscoveryChipItems.test.ts` | Chips |
| New offer-query unit tests | Bounds, eligibility parity, collector vs offer counts |
| `e2e/smoke/exchange.spec.ts` | Smoke for toolbar / drawer / grid chrome |

---

## Staged checklist

Implement only the step the user names. After each: report changes, checks, preview (`/the-exchange`), limitations; **STOP**.

- [x] **Step 0 — Plan (this doc)** — Inventory complete; hub linked; no app changes.
- [x] **Step 1 — Ornamental frame** — Reusable `OrnamentalFrame` / `OrnamentalCorner` (compact + standard).
- [x] **Step 2 — Below-hero chrome** — Toolbar → trade shortcuts/chips → results (existing cards) → activity; filters in `CatalogFilterDrawer` with draft/apply; `OrnamentalFrame` on toolbar + results; hero untouched; **data query unchanged**.
- [x] **Step 3 — Group discovery data** — 24 groups/page; narrow DTO; ≤3 attributed previews; offer + collector counts; shared eligibility (incl. price + `minRep` before pagination); on-demand offers API (5/page, cursor); page `force-dynamic`; cards wired via preview stubs + CTA fetch.
- [x] **Step 4 — Grid cards** — `ExchangeFragranceGroupCard`: main + ≤2 previews (simple when one); seller→catalog→neutral; offer count + bottle mark; factual primary trade badges; compare toggle; View collectors → existing offer/composer flow; 1/2/3 grid with sparse max-widths.
- [x] **Step 5 — List view + View collectors** — Grid/list share results + committed criteria (`view`); list rows with one open expansion; grid md+ wide side panel / mobile nearly full-screen sheet; shared `ExchangeOfferContent` + `useExchangeOffers` (5 + load more); fill display only when validated; guest/own-listing + action-boundary revalidate; filter changes reset collectors; panel trap pauses for session `Modal` (lightbox/composer).
- [x] **Step 6 — View collectors + on-demand offers** — Covered with Step 5 (panel/sheet/list share one query and offer content).
- [ ] **Step 7 — Filter drawer polish** — Nearly full-screen mobile if still needed beyond catalog primitive; confirm draft/apply vs live-URL.
- [ ] **Step 8 — States + recent activity polish** — Distinct empty / no-inventory / failure; temporary illustration slot; empty inset never under real results.
- [ ] **Step 9 — Harden** — i18n sync (`sync-translations` skill); unit + smoke tests; secondary sections placement; a11y pass; no hero/`TitleBanner` drift.

### Step 2 limitations (chrome)

- List view control is **disabled** (no `view` URL yet).
- Filter drawer reuses catalog primitive (**85dvh** bottom sheet below `md`, right panel from `md`) — not yet nearly full-screen mobile.
- Trade shortcuts update the URL immediately; other filters use draft/apply in the drawer.
- Secondary rails (wishlist / mutual / palate / seasonal) sit **below** activity, not in a sidebar.

### Step 3 — data notes

- Groups: offset `pg` (clamped); sort **name asc, id asc**. Offers: **cursor** on `updatedAt+id` (no arbitrary offer page jumps).
- `minRep` is applied in eligibility before pagination via a bounded trader set (`EXCHANGE_MIN_REP_TRADER_CAP`); reputation is not a DB column.
- Browse payload is narrow (counts + ≤3 previews). Full matching offers: `GET /api/exchange/offers`.
- Collector vs offer counts are on the group DTO; grid cards show **matching offer** count copy.
- **Fill level:** `UserPerfume.mlRemaining` (Float?) and `amount` (string capacity) exist; `available` is listed-for-sale ml. NoirRating bottle SVGs animate **rating** liquid, not inventory. Accurate fill % requires finite `mlRemaining` and parseable `amount > 0` — **never** infer from condition, rating, or ambiguous quantity. Group cards use outline bottle mark only (no fill). Offer DTO exposes volume fields for a later step.

### Step 4 — card notes

- View collectors uses the existing on-demand offers → composer / listing picker (or sign-in) until Step 5 panel.
- Trade badges reflect the **primary seller photo** listing only (factual for that image).
- Lightbox uses card preview URLs only; full per-offer galleries remain on-demand via offers API / later panel.

### Step 5 — list + collectors notes

- URL `view=list` (omit for grid). Same `availablePerfumes` + `filterQueryString` for both presentations.
- Offers: `GET /api/exchange/offers` via `useExchangeOffers`; first page 5; Load more appends cursor pages.
- Fill: `ExchangeOfferFillDisplay` + `resolveOfferFillPercent` only — no inferred %.
- Grid card CTA opens collectors for guests too; contact still requires sign-in; own listings show hint without CTA.
- Removed / stale offers marked at contact boundary after `verifyOfferStillAvailable`.

---

## Commands

```bash
# Typecheck / lint (scoped as needed)
npx tsc --noEmit
npx eslint app/the-exchange components/Molecules/Exchange* components/Containers/Exchange models/perfume-exchange.server.ts utils/exchange-*.ts utils/discovery-filters.ts

# Unit tests (Exchange-related)
npx vitest run models/perfume-exchange-discovery.server.test.ts utils/exchange-listing-filter.server.test.ts utils/exchange-listing-photos.test.ts app/the-exchange/buildExchangeDiscoveryChipItems.test.ts

# i18n after copy changes
npm run i18n:diff
# or follow .cursor/skills/sync-translations/SKILL.md

# Local preview
npm run dev
# Route: http://localhost:3000/the-exchange
```

Do **not** run `prisma db push`, `prisma migrate reset`, or production migrate for this redesign by default.

Browser review widths (align with catalog): **1440**, **820**, **390**.

---

## Unresolved data semantics

Decide explicitly in the Step 2 / Step 5 reports before locking copy:

1. **Offer vs collector counts** — Offer = eligible `UserPerfume` rows; collector = distinct `userId` among those rows. Confirm whether the viewer’s own listings are excluded from both (today photos/CTAs exclude self; summary count may still include self).
2. **“Newest” sort** — Newest fragrance created vs newest eligible listing `createdAt` vs max listing activity. Mockup label is illustrative; pick one server definition + stable tie-break.
3. **Notes / seasons** — Remain perfume-level (any-of) as today; they are **not** offer-level. Document in UI so users do not expect note filters to constrain a single bottle row beyond perfume membership.
4. **House filter** — Exchange URL today is a **single** `house` id; Archive allows many. Keep single unless a step explicitly expands discovery URL + query.
5. **Fill %** — Prefer `mlRemaining` / `amount` when both parse as finite and `amount > 0`; do not use `available` alone as “percent full” without a documented capacity. If data missing, omit the indicator.
6. **Price range** — Today uses listing `price` SQL extraction; confirm interaction with trade-only rows (null/empty price) under same-offer AND.
7. **Preview attribution** — Ordering when >3 eligible photos (newest listing, first photo, reputation, has-photos filter). Cap remains 3.
8. **Failure UX** — Whether to keep a previous client page snapshot on refresh failure (mockup banner) vs server-render only error; prefer honesty over silent stale pages.
9. **Compare** — Mockups show Compare; Exchange page has no compare toggle today. Preserve comparison **semantics** if an entry point already exists elsewhere for these perfumes; do not invent a parallel compare store. Confirm in Step 3 whether to wire `PerfumeCompareToggle` like Archive/home.
10. **Secondary rails** — Exact placement for wishlist / mutual / palate / seasonal after sidebar removal (collapsed sections vs below activity vs signed-in-only drawers).

---

## Applicable existing skills & rules

| Resource | Use when |
| --- | --- |
| `.cursor/skills/sync-translations/SKILL.md` | Any `messages/en.json` keys for Exchange copy |
| `.cursor/rules/reuse-ui-components.mdc` | Selects, inputs, buttons, search |
| `.cursor/rules/server-layers.mdc` / `docs/architecture.md` | Models vs API vs `lib/queries` |
| `.cursor/rules/prisma-migrations-only.mdc` / `no-database-deletion.mdc` | Default: no schema/migrate work |
| `.cursor/rules/docs-hub.mdc` | Keep this living doc linked from `docs/README.md` |
| `.cursor/rules/avoid-premature-optimization.mdc` / `arrow-functions.mdc` | Implementation style |
| Vercel `react-best-practices` skill | After substantive TSX batches |
| Pattern peer: `docs/catalog-redesign.md` | URL-driven catalog, drawer a11y, page size 24 |

**Do not** add a new Cursor skill or always-on rule for ordinary Exchange instructions; this document is the contract. A scoped rule is only warranted later if agents repeatedly violate hero/`TitleBanner` or sidebar constraints—and only with an explicit request.

---

## Mockup vs codebase mismatches (expected)

- Mockup permanent sidebar / desktop filter column → **drawer only**.
- Mockup page sizes and “1,248 fragrances” → real `count` queries; page size **24**.
- Mockup nav / founding spots / search hints → keep production nav and real `tradingPost` copy (adjust placeholders only via i18n when a step asks).
- Current grid is effectively 1→2→3 at `xl` with page size 16 and a sticky filter column → replace per layout contract.
- Current eager nested listings → on-demand offers (Step 5).
- `.noir-border` two-corner CSS → reusable four-corner treatment closer to mockups without changing global banner styles.
- Activity feed currently sits **above** the grid → move **below** results (Step 7).
- `minRep` post-filter → must move into shared eligibility (Step 2).

---

## Guardrails (summary)

- No `TitleBanner` / `.title-banner` edits.
- No permanent filter sidebar.
- No migrations / production data edits / push / deploy unless explicitly requested.
- No inventing fill levels, counts, or images.
- Preserve ads, saved searches, auth, own-listing behavior, galleries, and trade/contact flows.
- Stop after every requested step for visual review.
