# Seeking redesign

Implementation contract for adapting **Seeking** (owned wishlist at `/{userSlug}/profile/wishlist` and the public shared list at `/wishlist/[userId]`) to the supplied desktop mockup. This is a **layout + query-shape** change for the Seeking surfaces. Default: **no Prisma migration** unless a later step explicitly proves a schema gap that cannot be expressed with existing `UserPerfumeWishlist` / Exchange eligibility fields.

**Reference asset (illustrative only):**

- `C:\Users\bwclo\.cursor\projects\c-repos-shadow\assets\seekinng-f11f840f-c5cd-44b0-95a0-ee4e2b6450c2.jpg`

Product copy already brands this surface as **Seeking** (`messages/en.json` → `wishlist.*`); route paths and Prisma model names remain `wishlist` / `UserPerfumeWishlist`.

---

## Reference priorities

When sources disagree, resolve in this order:

1. **Written contract (this document)** — wins for functionality, data, workflow, and guardrails.
2. **Actual codebase** — authoritative for routes, auth, visibility, mutations, Exchange eligibility, and existing fields.
3. **Mockups** — authoritative for layout **below** the hero, hierarchy, groups, grid/list chrome, and card controls.
4. **Current Seeking hero in the running app** — authoritative for banner height, crop, image (`/images/wishlist.png` via `publicAssetUrl`), title position, overlays, and spacing (do not “improve” the hero from the mockup).

Mockup fragrance names, offer counts, navigation labels, and imagery are illustrative. Never hardcode or fabricate them.

---

## WORKFLOW

- Implement **only** the explicitly requested step from the staged checklist below.
- Attached images and mockup descriptions **do not** authorize completing later steps.
- After each step: report (1) files changed, (2) checks run, (3) preview URL/route, (4) remaining limitations; then **STOP** for visual review.
- Do **not** push, merge, deploy, edit production data, or author/apply migrations for this redesign unless a later step explicitly requests a migrate-backed change (default: none).
- Preserve unrelated in-progress work; keep diffs scoped to Seeking redesign files and shared pieces only when a step requires extending them (prefer optional props over forks).

---

## DESIGN

| Preserve | Detail |
| --- | --- |
| Hero | Current `TitleBanner` dimensions, crop, image, heading/subheading slot, and tracked-count child. Do **not** modify shared `TitleBanner` or global `.title-banner` for this work. |
| Navigation / footer | Real `GlobalNavigation` / mobile nav / footer from production; do not copy mockup nav chrome. |
| Theme | Burgundy / gold / charcoal Noir theme, existing fonts. |
| Ornament | Reuse `OrnamentalFrame` / `OrnamentalCorner` (Exchange/catalog pattern). Do not fork one-off corner markup per card. |

Changes begin **below** the hero.

---

## LAYOUT

Below the hero (owned Seeking page):

| Area | Contract |
| --- | --- |
| Public-share strip | Compact strip: hint that only public entries appear on the shared page; **Copy link** + **Preview shared page** (existing `/wishlist/{userId}` share path). |
| Toolbar | Search (“Search your Seeking list…”); visibility pills **All / Public / Private** with **full matching counts**; **Grid / List** toggle. |
| Group A | **Available on the Exchange** — items with ≥1 eligible Exchange offer. |
| Group B | **Still seeking** — items with no eligible Exchange offer. |
| Per group | Header + “Showing X–Y of Z” + page-size control (fixed **6**); grid or list of cards; independent section pagination. |
| Card (grid) | Image; status badge (**Available** vs **Still seeking**); title + house; for Available: offer count + **View offers** (opens on-demand offers); preferred format; visibility toggle; **View details** / **Remove**. |
| Card (list) | Same data and actions as grid; denser row layout. |
| Empty | Distinct empty for zero Seeking items vs zero matches for current search/visibility; do not invent alerts, priorities, budgets, or metadata rows. |

Public shared page (`/wishlist/[userId]`): **public entries only**, same burgundy/gold presentation language, **paginated** (see Data). Do not expose private items or private caches.

Footer note: each group loads 6 entries; collector offers load only when opened; list view uses the same pages.

---

## DATA

| Rule | Detail |
| --- | --- |
| Page size | **6** entries per group / public page (`SEEKING_GROUP_PAGE_SIZE`). |
| Group membership | Classify **Available** vs **Still seeking** on the **full filtered set** **before** pagination. |
| Availability | An item is Available iff **at least one eligible Exchange offer** exists for that perfume (shared eligibility with The Exchange — `resolveExchangeEligibility` / listing `available ≠ "0"` plus the same listing predicates the Exchange uses for browse). **Preferred format** (`bottlePreference`) remains a **recorded preference** only; it does **not** gate group membership unless a later step explicitly agrees otherwise. |
| Availability failure | If eligibility/availability resolution **fails**, do **not** classify those items as Still seeking. Surface a failure/retry (or omit classification) honestly. |
| Search | Server-side match on perfume name and house name. |
| Visibility filter | Server-side `isPublic` filter for All / Public / Private. |
| Counts | Filter pill counts and group totals cover **all matching** entries, not only the loaded page. Hero “fragrances being tracked” remains the owned list total consistent with current semantics (document in the data step if search should or should not shrink the hero count — default: hero = unfiltered owned total; toolbar pills = filtered totals). |
| Reset pages | When search or visibility changes, **reset both** group page params to 1. |
| Grid / List | Same server page DTOs; only presentation differs (`view`). |
| Offers | Load **only when opened**; **5 per page** (reuse Exchange offer page size / cursor pattern). Distinguish **offer count** (eligible `UserPerfume` rows) from **unique collectors** (distinct `userId`). |
| Preserve | Preferred format updates, visibility toggle, remove, perfume details link, share strip / public preview. |
| Bounds | No full wishlist download for browse; no eager nested offer fan-out; no N+1 trader/photo/reputation queries on the list page; no private data in shared/public caches. |
| Public route | `getPublicWishlist*` (or successor) returns **`isPublic: true` only** and **paginates**; never private rows. |
| Invent nothing | No new alerts, priorities, budgets, metadata fields, or routes beyond what this contract names (owned Seeking URL params + thin offers fetch aligned with Exchange). |

### Current baseline (code facts)

| Concern | Today |
| --- | --- |
| Owned page | `app/[userSlug]/profile/wishlist/page.tsx` — `requireOwnedProfileSession`; `getUserWishlist(user.id)`; banner `/images/wishlist.png`. |
| Owned client | `WishlistPageClient.tsx` — share strip; single unpaginated grid (`1/2/4` cols); client `isAvailable = item.perfume.userPerfume.length > 0`. |
| Public page | `app/wishlist/[userId]/page.tsx` — `getPublicSeekingPage` (public-only, 6/page); `PublicWishlistClient` → `ItemsSearchingFor` + Previous/Next. |
| Model | `models/wishlist.server.ts` — CRUD + visibility + bottle preference; `getUserWishlist` loads **all** rows then batches `userPerfume` where `available ≠ "0"` (eager listings; **not** full Exchange eligibility; prefer-format unused for classification). |
| Card | `WishlistItemCard` + typo filename `WishlistAvbalibilityInfo.tsx` — green “available from collectors” panel with **eager** listing rows; native `<select>` for preferred format; remove / visibility via `useToggleWishlist`. |
| API / mutations | `POST /api/wishlist` (`app/api/wishlist/route.ts`); `lib/mutations/wishlist.ts`; `revalidateWishlistPage` in `actions.ts`. |
| Schema | `UserPerfumeWishlist`: `isPublic`, `bottlePreference` (`sample` \| `partial` \| `full` \| `any`). |
| Exchange reuse | `resolveExchangeEligibility`, `getExchangeMatchingOffersPage` (`models/perfume-exchange-groups.server.ts`); `EXCHANGE_OFFER_PAGE_SIZE = 5`; `GET /api/exchange/offers`. |
| Tests | `models/wishlist.server.test.ts` (public-only); `models/wishlist-matching.server.test.ts`; `models/user-alerts.wishlist-availability.server.test.ts`; e2e `e2e/journeys/profile-privacy.spec.ts` (visibility API). |
| i18n | `wishlist.*` in `messages/en.json` (+ es/fr/it). Item card still has celebratory “AVAILABLE IN TRADING POST” copy — redesign should move to sober Available / Still seeking labels via i18n when a copy step asks. |

**Step 2 data layer (done):** `getOwnedSeekingPage` / `getSeekingAvailableGroupPage` / `getSeekingStillSeekingGroupPage` provide search + visibility + eligibility-before-pagination + 6/page + counts. Legacy `getUserWishlist` unchanged for existing consumers.

Remaining after Step 8 verify: Step 7 copy polish still optional; owned grid/list + offers need signed-in browser QA (blocked without session this pass).

---

## Architecture (target)

URL-driven, server-rendered Seeking for the owned page (catalog/Exchange pattern): client builds hrefs and `router.push(..., { scroll: false })`. Offers load via authenticated-aware API + client query when **View offers** opens (prefer extending Exchange offers path with Seeking context, or a thin Seeking-scoped wrapper that **reuses** the same eligibility + 5/page cursor — do not duplicate eligibility rules).

| Concern | Location |
| --- | --- |
| Owned page | `app/[userSlug]/profile/wishlist/page.tsx` |
| Owned client | `WishlistPageClient.tsx` (evolve / split if large) |
| Public page | `app/wishlist/[userId]/page.tsx` + `PublicWishlistClient.tsx` |
| Wishlist models | `models/wishlist.server.ts` (mutations + legacy `getUserWishlist`); **`models/wishlist-seeking.server.ts`** (grouped/paginated Seeking queries) |
| Types / constants | `types/seeking.ts`, `utils/seeking-constants.ts` (`SEEKING_GROUP_PAGE_SIZE = 6`) |
| Eligibility | Shared with Exchange (`resolveExchangeEligibility` + Seeking `user.isBanned: false`; own listings excluded via `viewerId`) |
| Offers | Reuse `getExchangeMatchingOffersPage` + `lib/queries/exchange-offers.ts` / `GET /api/exchange/offers` (or Seeking-named route that delegates) |
| Cards | Evolve `WishlistItemCard`; retire eager `WishlistAvbalibilityInfo` listing dump in favor of on-demand offers UI |
| Chrome | `OrnamentalFrame`; `PaginationBar`; `Select` / search atoms per `.cursor/rules/reuse-ui-components.mdc` |
| Params helper | **`utils/seeking-params.ts`** (+ test); query keys in `lib/queries/seeking.ts` |
| Page chrome | `SeekingToolbar.tsx`, `SeekingGroupSection.tsx` under owned wishlist route |
| Revalidate | `app/[userSlug]/profile/wishlist/actions.ts` |

Prisma stays in `models/*.server.ts` per `docs/architecture.md` and `.cursor/rules/server-layers.mdc`.

### URL contract (proposed — owned Seeking)

| Key | Values | Notes |
| --- | --- | --- |
| `q` | search string | Perfume / house name; omit when empty |
| `vis` | `all` (default), `public`, `private` | Visibility filter |
| `view` | `grid` (default), `list` | Same data |
| `pgAvail` | 1-based page | Available on the Exchange group |
| `pgSeek` | 1-based page | Still seeking group |

Defaults omitted from generated URLs. Invalid values fall back; pages past the end clamp on the server. Changing `q` or `vis` resets **both** `pgAvail` and `pgSeek` to 1.

### URL contract (proposed — public shared list)

| Key | Values | Notes |
| --- | --- | --- |
| `pg` | 1-based page | Public entries only; page size **6** |
| `q` | optional search | If implemented on public surface in a later step; otherwise document omission |
| `view` | `grid` / `list` | Optional if public UI matches owned chrome |

Public query must enforce `isPublic: true` in the server `where` regardless of URL tampering.

---

## Query plan

Owned Seeking loader (conceptual):

1. **Auth** — `requireOwnedProfileSession(userSlug, { subPath: "wishlist" })`.
2. **Parse** — `q`, `vis`, `view`, `pgAvail`, `pgSeek` from searchParams.
3. **Base where** — `userId = session.user.id`; apply `isPublic` when `vis` is public/private; apply name/house search (`contains` / existing search helpers — bounded, indexed fields only).
4. **Classify** — For perfume ids in the filtered wishlist set, resolve which have **≥1 eligible Exchange listing** via shared eligibility (single batched existence query / grouped count — **not** per-item N+1). On eligibility **error**: fail the availability channel; **do not** dump failed ids into Still seeking.
5. **Partition** — `availableIds` vs `stillSeekingIds` (stable order, e.g. `createdAt desc`, `id desc`).
6. **Count** — Totals for All / Public / Private pills (matching `q` where applicable); totals for each group after visibility+search filter.
7. **Paginate** — Independently `slice`/`skip`+`take` **6** for each group **after** partition.
8. **DTO** — Narrow card fields: wishlist id, perfume id/name/slug/image, house, `isPublic`, `bottlePreference`, `createdAt`, `offerCount`, `collectorCount` (for Available only; still-seeking counts are zero / omitted). **No** nested offer rows on the page payload.
9. **Offers (on open)** — `perfumeId` + eligibility + cursor; **5**/page; return offer vs collector distinctions in API/DTO copy as needed.

Public loader:

1. Resolve trader; **404** if missing.
2. `where: { userId, isPublic: true }` (+ optional search).
3. Paginate **6**; optional Available/Still seeking split **only** if a later step explicitly extends public chrome to groups — default Step plan: paginated public list first; group chrome on public is optional and must not leak private items.

---

## Component / file map

### Keep / extend (primary)

| File | Role |
| --- | --- |
| `app/[userSlug]/profile/wishlist/page.tsx` | Server loader; dual-group DTOs; searchParams |
| `app/[userSlug]/profile/wishlist/WishlistPageClient.tsx` | Below-hero chrome; groups; grid/list; pagination |
| `app/[userSlug]/profile/wishlist/actions.ts` | Path revalidation after mutations |
| `app/wishlist/[userId]/page.tsx` | Public loader; public-only pagination |
| `app/wishlist/[userId]/PublicWishlistClient.tsx` | Public UI |
| `models/wishlist.server.ts` | Paginated/grouped queries; preserve mutations |
| `lib/mutations/wishlist.ts` | Add/remove/visibility/bottle preference |
| `app/api/wishlist/route.ts` | Existing POST actions |
| `components/Organisms/WishlistItemCard/WishlistItemCard.tsx` | Card/row for both groups |
| `components/Organisms/WishlistItemCard/WishlistAvbalibilityInfo.tsx` | Replace eager list with on-demand offers host or delete once unused |
| `components/Atoms/OrnamentalFrame/*` | Toolbar / group frames |
| `components/Molecules/PaginationBar` | Per-group pagination |
| `models/perfume-exchange-groups.server.ts` | Eligibility + offers page |
| `app/api/exchange/offers/route.ts` / `lib/queries/exchange-offers.ts` | On-demand offers |
| `messages/{en,es,fr,it}.json` | Seeking copy keys |
| `components/Organisms/TitleBanner` | **Do not modify** |

### Likely new (names indicative)

| Piece | Purpose |
| --- | --- |
| `utils/seeking-params.ts` (+ test) | Parse/serialize URL state; reset pages on filter change |
| Seeking toolbar molecule | Search + visibility pills + grid/list |
| Seeking group section | Header, meta, grid/list, pagination |
| On-demand offers panel/sheet | 5/page; offer vs collector copy |
| Public pagination wiring | `pg` (+ optional `q`/`view`) |

### Tests to update / add

| File | Focus |
| --- | --- |
| `models/wishlist.server.test.ts` | Public-only; pagination bounds; search/vis filters; classify-before-paginate; failure ≠ Still seeking |
| New seeking-params unit tests | Defaults, reset both pages, clamp |
| Offer integration (unit) | 5/page; eligibility parity; offer vs collector counts |
| `e2e/journeys/profile-privacy.spec.ts` | Keep visibility semantics; extend smoke only if a step asks |

---

## Staged checklist

Implement only the step the user names. After each: report changes, checks, preview route, limitations; **STOP**.

- [x] **Step 0 — Plan (this doc)** — Inventory complete; hub linked; no app changes.
- [x] **Step 1 — Below-hero chrome + URL/state wiring** — See notes below. Uses Step 2 queries; existing cards temporarily.
- [x] **Step 2 — Grouped server data** — See notes below.
- [x] **Step 3 — Grid cards** — See notes below.
- [x] **Step 4 — List view** — See notes below (with Step 5 offers host).
- [x] **Step 5 — On-demand offers** — See notes below.
- [x] **Step 6 — Public shared page** — See notes below.
- [ ] **Step 7 — Copy + i18n** — Optional polish pass; locale key sync already clean (`sync-translations-diff` empty gaps).
- [x] **Step 8 — Harden / verify** — See evidence below (2026-10-20).

---

## Commands

```bash
# Typecheck / lint (scoped as needed)
npx tsc --noEmit
npx eslint "app/[userSlug]/profile/wishlist" "app/wishlist" models/wishlist.server.ts components/Organisms/WishlistItemCard

# Unit tests (Seeking-related + isolated scale fixtures)
npx vitest run utils/seeking-params.test.ts utils/seeking-constants.test.ts utils/seeking-bounds.scale.test.ts models/wishlist-seeking.server.test.ts models/wishlist.server.test.ts "app/[userSlug]/profile/wishlist/actions.test.ts"

# i18n after copy changes
npm run i18n:diff
# or follow .cursor/skills/sync-translations/SKILL.md

# Local preview (owned Seeking — replace slug)
npm run dev
# Owned:  http://localhost:3000/{userSlug}/profile/wishlist
# Public: http://localhost:3000/wishlist/{userId}
```

Do **not** run `prisma db push`, `prisma migrate reset`, or production migrate for this redesign by default.

Browser review widths (align with catalog/Exchange): **1440**, **820**, **390**.

---

### Step 2 — data notes (2026-10-20)

| Decision | Detail |
| --- | --- |
| Module | New `models/wishlist-seeking.server.ts` — **does not** change `getUserWishlist` / public full-list helpers (existing consumers preserved). |
| Classification | Relational `perfume.userPerfume.some(listingWhere)` vs `none(listingWhere)` **before** `skip`/`take`. No full wishlist id materialization. |
| Eligibility | `resolveExchangeEligibility({ viewerId: owner })` → `available ≠ "0"` + **exclude own offers**; Seeking ANDs `user.isBanned: false`. No discovery filters on Seeking browse. |
| Preferred format | Stored on DTO only; **never** in group/eligibility predicates. |
| Counts | Pill counts = same search, per-visibility; group `totalCount` = full matching group size; page DTOs carry `offerCount` (row `_count`) + `collectorCount` (distinct `userId`). No ml inference. |
| Failure | `SeekingAvailabilityError` → `availabilityStatus: "failed"`, both groups empty (not dumped into Still seeking). |
| Ordering | `createdAt desc`, `id desc` (stable page boundaries). |
| Page size | Hard-capped at **6** (`SEEKING_GROUP_PAGE_SIZE`). |
| Hero | Unfiltered owned total (`getOwnedSeekingHeroTotal`). |
| Indexes | No migration. Relies on existing `idx_wishlist_user_created` (`userId`, `createdAt`), `idx_wishlist_perfume`, `idx_user_perfume_perfume_available`, perfume/house `name` indexes. Optional later: `(userId, isPublic, createdAt)` if visibility pills show sequential scans under load — not required for Step 2. |
| Tests | `models/wishlist-seeking.server.test.ts`, `utils/seeking-constants.test.ts`. Vitest: `css.postcss.plugins: []` in `vitest.config.ts` so suites load despite Tailwind PostCSS tuple. |

API surface: `getOwnedSeekingPage`, `getSeekingAvailableGroupPage`, `getSeekingStillSeekingGroupPage`, `getOwnedSeekingVisibilityCounts`.

### Step 1 — page structure / state notes (2026-10-20)

| Decision | Detail |
| --- | --- |
| Layout | Hero unchanged → compact share strip → toolbar (search, All/Public/Private, Grid/List) → Available group → Still seeking group. |
| URL | `q`, `vis`, `view`, `pgAvail`, `pgSeek` via `parseSeekingOwnedState` / `buildSeekingOwnedHref`. Defaults omitted. Invalid enums/pages fall back. Server clamps out-of-range pages; client `replace`s URL when clamped. |
| Navigation | `useCatalogNavigation` + `router.push(..., { scroll: false })`. Search/visibility → `withSeekingFilterChange` (both pages → 1). View → `withSeekingViewChange` (pages preserved). Back/Forward restore via `searchParams`. |
| Pagination | Previous/Next per group only (no infinite append). Accessible nav labels + page status. |
| Counts | Hero = `heroTotalCount` (full tracked list). Pill counts + group “Showing X–Y of Z” = active search/visibility filter. |
| Stale / cache | Server-rendered page payload. `seekingQueryKeys.ownedData` includes search, visibility, both pages. While a filter change is pending, group **items** are suppressed so a prior filter is never shown as current. |
| Cards | Existing `WishlistItemCard` adapted with empty `userPerfume` (offers still Step 5); `availableAmount={0}` (no ml inference). |
| Empty / failure | Empty tracked list → Archive/Guide links. Filter with zero matches → `noMatches`. Empty group → per-group empty copy. Availability failure → alert + retry; groups not shown as Still seeking. |
| Share | `/wishlist/{userId}` copy + preview unchanged. |

**Limitations after Step 1 (historical):** denser list rows and on-demand offers landed in Steps 4–5. Public Seeking page still not updated (Step 6).

### Step 3 — card presentation notes (2026-10-20)

| Decision | Detail |
| --- | --- |
| Shell | `OrnamentalFrame` compact + charcoal card; image `aspect-[4/3]` over `bg-noir-dark` burgundy panel; gold text links. |
| Grid | 1 / 2 (`md`) / 3 (`lg`); `justify-items-start` + `max-w-md` so sparse groups keep normal card widths. |
| Badge | Subtle gold **Available** / muted **Still seeking** (no celebratory copy, no pulse). |
| Available extras | Accurate `offerCount` from DTO; **View offers** opens on-demand offers (Step 5). |
| Controls | Preferred format via `Select` atom; Public/Private `VooDooCheck`; concise `privacyHint`; **View details** + quiet **Remove** (DangerModal confirm). |
| Removed | Green availability box, whole-card gold gradient, floating red X, long privacy paragraphs. |
| Mutations | Existing `useToggleWishlist`; pending/`aria-busy`; local state reconciles from props; errors roll back preference/visibility; visibility/remove call parent refresh; URL clamp still clears empty final pages. |
| Images | Responsive `sizes`; fallback `/images/single-bottle.webp`. No catalog/global card defaults changed. |

### Step 4 + 5 — list view & on-demand offers (2026-10-20)

| Decision | Detail |
| --- | --- |
| List rows | `SeekingWishlistItemRow`: stacked mobile layout (no horizontal edit tables); same groups/counts/pages/controls as grid; denser thumb + meta. |
| Offers host | Grid md+: `ExchangeCollectorsPanel` side panel; mobile: nearly full-screen sheet; list: inline expansion, **one** perfume open. |
| Fetch | `useExchangeOffers` → `GET /api/exchange/offers` (5/page cursor); `filterQueryString=""` so eligibility matches Seeking Available (Exchange base + viewer exclusion). Load-more bounded; request generation guards stale appends. |
| Reset | Clear panel/expansion on search, visibility, either group page, or view change; drop ids missing from current page payload. |
| Presentation | Reuse `ExchangeCollectorsOffers` / `ExchangeOfferContent`: public trader name → profile link; attributed listing photos (lightbox on demand); factual ml/type/condition/price; trade CTA via existing `TradeComposerModal` after `verifyOfferStillAvailable`. No invented DM/swap or preferred-format match copy. |
| States | Loading / error+retry / empty offers / unavailable (removed) offers handled independently. Contact rechecks auth + availability. Body scroll lock + focus restore on panel/sheet. |
| Cards | Grid **View offers** opens panel/sheet (no longer navigates away to Exchange). |

**Limitations (after Step 5):** Exchange browse still omits Seeking’s extra `isBanned` listing filter on offers API.

### Step 6 — public shared-list pagination (2026-10-20)

| Decision | Detail |
| --- | --- |
| Route / link | Unchanged `/wishlist/[userId]`; share strip copy + preview paths preserved. |
| Query | `getPublicSeekingPage` in `wishlist-seeking.server.ts`: `where: { userId, isPublic: true }` applied **before** count and `skip`/`take`; page size **6**; order `createdAt desc`, `id desc`; out-of-range pages clamp. |
| DTO | Narrow `PublicSeekingItemDto` (id, perfumeId, bottlePreference, createdAt, perfume) — no `isPublic` flag, no private rows, no offer/availability counts, no owner edit fields. |
| UI | Simple public list via `ItemsSearchingFor`; Previous/Next; hero count = **public** `totalCount`; empty copy when zero public entries. No owner format/visibility/remove controls. |
| URL | `pg` via `parseSeekingPublicState` / `buildSeekingPublicHref`; defaults omitted; client `replace`s when server clamps. |
| Cache | `revalidateWishlistPage(userSlug, userId)` revalidates owned path **and** `/wishlist/{userId}` after visibility/remove/preference mutations. |
| Auth | Owner mutations remain on `POST /api/wishlist` with session auth; public page is read-only. |
| Tests | Public query where/select/clamp/empty; public URL params; revalidatePath coverage. Legacy `getPublicWishlistForUser` kept for non-page callers. |

**Limitations:** Public surface has no search/`view`/Available–Still seeking groups (optional later).

### Step 8 — harden / verify evidence (2026-10-20)

**Page size note:** Contract originally said 12; product set `SEEKING_GROUP_PAGE_SIZE = 6`. Still satisfies **≤12** per group/public request.

#### Mocked scale (not DB performance)

| Fixture | Evidence |
| --- | --- |
| Isolation | `utils/seeking-bounds.scale.test.ts` + mocked Prisma case in `models/wishlist-seeking.server.test.ts`. **No production/shared DB seeding.** |
| 1,250 Seeking entries | Classify → paginate; each page length = 6; `clampSeekingPageSize(999) === 6`. |
| Visibility/search before page | Public+search Available page excludes private/non-matching ids. |
| Independent pages | Available page 2 vs Still-seeking page 4 use separate skips/totals. |
| 420 offers | Cursor pages length = `EXCHANGE_OFFER_PAGE_SIZE` (5); hasMore true. |
| No full ID dump | Page DTO length 6 ≪ 2,000; soft JSON &lt; 50KB; no nested `userPerfume`. |
| Grid/list reuse | `seekingDataQueryKeyParts` ignores `view`; view change preserves `pgAvail`/`pgSeek`. |
| Last-page delete clamp | 7→6 items clamps requested page 2 → page 1. |
| Failure ≠ Still seeking | Existing unit: eligibility throw → `availabilityStatus: "failed"`, both groups empty. |
| Public/auth | Public `where.isPublic: true` before count/take; `revalidateWishlistPage` hits owned + `/wishlist/{userId}`; API mutations require `authenticateUser`. |

Vitest this pass: **47** passed (seeking params/constants/bounds/scale + wishlist-seeking + actions + legacy public + exchange bounds).

#### Quality gates

| Gate | Result |
| --- | --- |
| ESLint (Seeking paths) | **Pass** (exit 0) |
| `tsc --noEmit` | **Pass** (exit 0; no Seeking-related errors) |
| i18n diff | **Pass** — es/fr/it missing/extra/placeholders empty |
| `TitleBanner` | **Untouched** (no Seeking diff under `components/Organisms/TitleBanner`) |
| `npm run build` | **Blocked** — `prisma generate` EPERM rename of `query_engine-windows.dll.node` (file lock; typically concurrent `next dev`) |
| `next build` alone | **Blocked** — compile OK, then TS fail in generated `.next/dev/types/routes.d.ts` (`k-votes": {}` corruption). **Not a Seeking source error**; clean rebuild needs unlocked Prisma client + fresh `.next` |

#### Browser (public shared list)

| Width | Result |
| --- | --- |
| **1440** | Public `/wishlist/{userId}` loads; TitleBanner/`title-banner` present; heading “Monkeey One is looking for”; count + Copy link + profile link. |
| **390** | Hero ~426px; list row + “Showing 1 – 1 of 1”; mobile bottom nav present (`bottom` = viewport). |
| **320** | Layout holds (narrow mobile chrome). |
| **1024 / 820** | Not re-shot this pass (same public template; no owned session). |
| Owner edit controls | **Absent** on public HTML (no wishlist visibility toggle / bottle select / Remove / View offers). |
| Owned route | Unauthenticated `/{slug}/profile/wishlist` → **`/sign-in`** (owner gate). |
| Grid/list, offers panel, empty/error, keyboard trap, long-name stress | **Blocked** — requires signed-in owned Seeking with multi-page + Available items. Not exercised without credentials. |
| Translated copy | Locale files synced; live locale switch not clicked this pass. |

**Visual differences vs mockup:** Public page remains a simple list (not dual Available/Still seeking). Owned page size is **6** (footer copy matches). No production seed of 1,000+ rows — scale proven only via isolated fixtures.

## Unresolved semantics (decide in later step reports)

1. **Hero count vs filters** — **Resolved (Step 2):** hero = unfiltered owned total.
2. **Own listings** — **Resolved (Step 2):** excluded (`viewerId` = owner), same as Exchange “available to acquire”.
3. **Public page groups** — **Resolved (Step 6):** single paginated public list (no dual groups).
4. **Offers API** — **Resolved (Step 5):** reuse `GET /api/exchange/offers` with empty discovery filters.
5. **Preferred format vs eligibility** — **Resolved (Step 2):** preference-only; does not gate availability.
6. **Rename typo file** — `WishlistAvbalibilityInfo.tsx` → correct spelling only when a step touches that module (avoid drive-by renames).
7. **Exchange `isBanned`** — Seeking adds ban filter on top of Exchange eligibility; Exchange browse itself still omits `isBanned` until a separate Exchange fix.

---

## Applicable existing skills & rules

| Resource | Use when |
| --- | --- |
| `.cursor/skills/sync-translations/SKILL.md` | `messages/en.json` Seeking keys |
| `.cursor/rules/reuse-ui-components.mdc` | `Select`, inputs, buttons, search |
| `.cursor/rules/server-layers.mdc` / `docs/architecture.md` | Models vs API vs `lib/queries` |
| `.cursor/rules/prisma-migrations-only.mdc` / `no-database-deletion.mdc` | Default: no schema/migrate work |
| `.cursor/rules/docs-hub.mdc` | Keep this living doc linked from `docs/README.md` |
| `.cursor/rules/avoid-premature-optimization.mdc` / `arrow-functions.mdc` | Implementation style |
| Pattern peers | `docs/catalog-redesign.md`, `docs/exchange-redesign.md` |

**Do not** add a new Cursor skill or always-on rule for ordinary Seeking instructions; this document is the contract.

---

## Mockup vs codebase mismatches (expected)

| Mockup | Code / contract |
| --- | --- |
| Nav labels / Admin | Keep production navigation |
| 1,248 tracked / group sizes | Real `count` queries |
| Celebratory available badge copy | Replace via i18n with Available / Still seeking |
| Eager offers on card | On-demand, 5/page |
| Native select styling | Prefer `@/components/Atoms/Select` |
| Single grid of all items | Two server-paginated groups |
| Public page as simple trader list | Paginated public-only Seeking chrome |
| Availability = any `available ≠ "0"` row | Eligible Exchange offer via shared eligibility |

---

## Guardrails (summary)

- No `TitleBanner` / `.title-banner` edits.
- No invented alerts, priorities, budgets, metadata, or routes.
- No full wishlist/offer downloads; no N+1; no private data in public caches.
- Availability failure must **not** classify items as Still seeking.
- Preferred format is a preference unless separately agreed.
- Distinguish offers from unique collectors.
- No migrations / production data edits / push / deploy unless explicitly requested.
- Stop after every requested step for visual review.
