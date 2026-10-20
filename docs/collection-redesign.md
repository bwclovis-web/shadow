# My Scents Collection redesign

Implementation contract for adapting the main **Collection Archive** surface (`/{userSlug}/profile/my-scents`) to the supplied desktop (~1440px), tablet (~820px), and mobile mockups. This is a **layout / presentation** change below the hero: Collection grid + optional list, and a right-side **Edit destash** editor on My Listings. Default: **no Prisma migration**.

**Confirmed against local code** (branch `main`, inspection date 2026-10-20). Working tree was clean at plan time; leave unrelated local work untouched if it appears later.

**Reference assets (illustrative layout only):**

- Desktop: `C:\Users\bwclo\.cursor\projects\c-repos-shadow\assets\collect-desk-e4e1bff0-ed35-43a4-ad6e-6dce70bca5a8.jpg`
- Tablet: `C:\Users\bwclo\.cursor\projects\c-repos-shadow\assets\collect_tab-ffe8acab-b732-43cc-9da6-28f64f48ef44.jpg`
- Mobile: `C:\Users\bwclo\.cursor\projects\c-repos-shadow\assets\collect-mobile-588fbf51-39fb-4e0d-a4f8-74a799a0f5eb.jpg`

**Related (reliability, not this redesign):** [destash-improvements.md](./destash-improvements.md). Do **not** assume every checklist item there is finished; treat that doc’s Stage checkboxes as source of truth. Volume writers/budget helpers are largely wired (Stages 1–5 marked done as of 2026-10-20); operator manual smoke and a few docs updates remain open.

---

## Reference priorities

When sources disagree, resolve in this order:

1. **Written contract (this document)** — wins for scope, workflow, reuse, and guardrails.
2. **Actual codebase** — authoritative for routes, auth, CSRF, mutations, budget math, i18n keys, and existing fields.
3. **Mockups** — authoritative for layout **below** the hero: toolbar, grid/list density, card actions, and Edit destash rail chrome.
4. **Current My Scents hero in the running app** — authoritative for banner height, crop, image (`/images/perfumes.png` via `publicAssetUrl`), title/subheading, overlays, and spacing (do not “improve” the hero from mockups).

Ignore mockup-generated hex codes, cream editor surfaces, extra navigation chrome, invented photo limits, sample authenticity claims, and rewritten acknowledgments. Use existing theme tokens and existing disclaimer / destash copy.

---

## WORKFLOW

- Implement **only** the explicitly requested step from the staged checklist below.
- Attached images and mockup descriptions **do not** authorize completing later steps.
- After each step: report (1) files changed, (2) checks run, (3) preview URL/route, (4) remaining limitations; then **STOP** for visual review.
- Do **not** push, merge, deploy, edit production data, or author/apply migrations unless a later step explicitly requests a migrate-backed change (default: **none**).
- Preserve unrelated in-progress work; keep diffs scoped to Collection redesign files and shared pieces only when a step requires extending them (prefer optional props / scoped variants over forks).

---

## SCOPE

| In scope | Out of scope (deferred) |
| --- | --- |
| Main Collection **grid** + optional **list** view | Single-collection / bottle page (`…/my-scents/[perfumeId]`) visual redesign |
| Collection toolbar: add CTA placement below hero, search, sort, grid/list toggle | Replacing hero height/crop/title/spacing |
| Card / row content: brand, name, owned ml, listed ml, View bottle, Create destash | Inventing per-bottle allocation ledgers |
| My Listings **Edit destash** as a **right-side editor** (desktop/tablet rail; mobile nearly full-screen sheet) | Parallel validation, mutation, upload, or state systems |
| Keep existing full-page destinations available (`…/[id]`, `…/[id]#destash`) | Exchange / Seeking / Archive redesign work |
| Ornamental framing for results shell (reuse) | New color palette or grayscale product imagery |

---

## VISUAL CONTRACT

| Preserve | Detail |
| --- | --- |
| Colors | Existing Noir theme tokens (`noir-gold`, `noir-black`, etc.). No mockup hex adoption. |
| Images | **Original colors.** Do **not** apply resting grayscale filters on collection/listing thumbs. Today `CARD_IMAGE_HOVER_CLASS` / `CARD_THUMB_HOVER_CLASS` use `grayscale-100` → color on hover (`utils/card-motion.ts`) — **do not reuse those classes** on Collection cards/rows; add a color-preserving hover variant or plain `object-cover` motion if needed. |
| Hero | Current `TitleBanner` on `MyScentsPageClient`: image, `object-bottom`, `heading` / `subheading` from `myScents.*`. Do **not** modify shared `TitleBanner` or global `.title-banner` for this work. |
| Nav / footer / fonts | Real global navigation and footer; production fonts. |
| Terminology | Existing product language and i18n keys: **Collection** / **Exchange Listings**, **destash**, **Create Destash**, **Edit Destash**, pause/resume listing copy. Do not rename surfaces to mockup-only labels (“My Scents”, “Pause destash”) unless a later copy step explicitly updates keys. |
| Destash language | Keep `myScents.destashManager` / `myScents.listItem` / `listing.*` / disclaimer from `decantSplits.wizard` (already used by `DeStashForm`). |

Changes begin **below** the hero.

---

## LAYOUT

### Collection (inventory tab)

| Area | Contract |
| --- | --- |
| Tabs | Keep `MyScentsViewTabs` → `ViewTabs` with URL `view` (`inventory` default / `listings`). Labels from `myScents.tabs.*`. |
| Toolbar | Below tabs: primary **Add to Collection** (existing modal trigger), search, sort, optional house/amount filters (may collapse or stay; do not drop filter capability silently), **grid/list** toggle (`ResultsViewToggle`). |
| Results shell | Prefer `OrnamentalFrame` around the collection results region (Exchange/Seeking pattern). |
| Grid | Responsive columns: **3** at `≥1200px` / **2** at `768–1199px` / **1** below `768px` (`min-[1200px]:grid-cols-3`). |
| List | Dense rows: thumb + brand/name + owned/listed + wrapping actions; same data and actions as grid. URL `layout=list` (tab remains `view`). |
| Card actions | **View bottle** → existing bottle route `/{userSlug}/profile/my-scents/{userPerfumeId}`. **Create destash** → start create flow (prefer rail/sheet when hosted on this page; full-page `#destash` remains available). |
| Pagination | Keep client-side page slice + URL `pg` + `PaginationBar`. |

### My Listings + Edit destash rail

| Area | Contract |
| --- | --- |
| Listings chrome | Keep `ListingsTab` → `DecantSplitsPanel` + `MyListingsPanel`. Layout polish allowed; do not remove pause/resume or split panel. |
| Edit entry | **Edit** opens a **right-side editor** (not navigation-only). Desktop/tablet: right rail overlay. Mobile: nearly full-screen sheet (same pattern family as `CatalogFilterDrawer`). |
| Full page | Always expose **Open full page** (or equivalent) → existing `…/my-scents/{id}#destash`. |
| Form | **One** `DeStashForm` + **one** mutation controller path shared with bottle-page `DestashManager`. |
| Summary | Fragrance thumb + name/house; owned / listed / reserved / available from existing budget payload (already shown in `DeStashForm`). |
| Footer | Cancel + Save changes; Pause via existing pause action (edit only). Reuse existing acknowledgment checkbox copy. |

---

## DATA & READINESS

### Pagination (current — ready)

| Fact | Location |
| --- | --- |
| Page size | `useResponsivePageSize()` → mobile **6** / tablet **8** / desktop **16** (`hooks/useMediaQuery.ts`) |
| Slice | Client: `filteredData.slice((page-1)*pageSize, …)` in `MyScentsPageClient` |
| URL | `pg` query param; reset when switching `view`; clamp when filters shrink pages |
| UI | `PaginationBar` when `totalPages > 1` |

No server pagination for Collection today (full inventory loaded via `getUserPerfumes`). Redesign keeps that model unless a later step proves a scale need.

### Volume accounting (display vs allocate)

| Surface | Readiness | Notes |
| --- | --- | --- |
| Collection card Owned / Listed | **Display-ready** with existing helpers | Owned: `parseMl(amount)` per bottle row. Listed for perfume pool: `totalListedMlForPerfume` / listing status via `getInventoryListingStatus` (`lib/user-inventory.ts`). Multi-bottle perfume: show honest per-bottle owned + perfume-level listed (or document chosen UX in the card step — do not invent bottle-scoped listed ledgers). |
| Edit rail Owned / Listed / Reserved / Available | **Ready via budget API** | `usePourableMlBudget` + `DeStashForm` compact budget strip (`myScents.destashManager.budgetOwned` etc.). Same pourable formula as splits. |
| Writers / caps | See [destash-improvements.md](./destash-improvements.md) | Stages 1–3 client/server alignment marked done; do not reimplement validation. Manual smoke still open there. |
| Unknown owned (`"full"`, etc.) | Server rejects new positive allocation; form surfaces unknown state | Collection display should not pretend numeric owned when parse is 0/unknown — prefer honest empty/unknown treatment if shown. |

### Mutations (do not fork)

| Action | Existing path |
| --- | --- |
| Add to collection | `AddToCollectionModal` / `useMyScentsForm` → `POST /api/user-perfumes` `action=add` |
| Create / edit destash | `DestashManager` + `lib/destash-form-payload` → `decant` / `create-decant` |
| Pause / resume | `postDecantListingAmount` / DestashManager pause; MyListingsPanel already rolls back on failure |
| Photos | Existing `ImageUploader` + listing metadata pipeline |
| Budget | `GET /api/user-perfumes/budget` |

---

## REUSE DECISIONS

| Piece | Decision |
| --- | --- |
| `MyScentsPageClient` | Keep as page orchestrator (data, filters, pagination, view URL). Add layout-mode state (`grid`/`list`) and destash-editor host state (open listing id / create context). Prefer URL for view mode (e.g. `layout=list`) consistent with Seeking/Archive patterns. |
| `CollectionTab` | Primary Collection layout target: toolbar, OrnamentalFrame shell, grid vs list, pagination wiring. |
| `CollectionGridItem` | **Extend** with owned/listed lines + action buttons + optional overflow menu; add `variant: "grid" \| "list"` **or** a thin `CollectionListItem` that shares pure display helpers — no parallel data fetching. |
| `MyScentsViewTabs` | Keep; no parallel tab system. |
| `ListingsTab` / `MyListingsPanel` | Keep pause/resume/list cards; change Edit to open rail; retain link to full page. |
| `DestashManager` | **Controller reuse.** Extract shared submit/pause/create/edit handlers if needed so rail and bottle page call the same functions; avoid a second mutation stack. Bottle page continues to embed DestashManager (or the extracted controller + form). |
| `DeStashForm` | Single form component; optional `layout="page" \| "rail"` for spacing/sticky footer only — same validation, budget, photos, disclaimer. |
| Drawer primitive | Reuse focus-trap / portal / body-scroll / Escape patterns from `CatalogFilterDrawer`. Prefer a **scoped destash editor shell** (Cancel/Save/Pause footer) rather than forcing filter Clear/Apply semantics onto destash. Do not fork ornamental chrome — reuse `OrnamentalFrame` / `chrome` ideas. |
| `OrnamentalFrame` | Results shell + rail chrome; sizes `compact` / `standard` as today. |
| `ResultsViewToggle` | Reuse for Collection grid/list. |
| Search / sort / filters | Keep `SearchInput`, `Select`, existing house/min/max filters (`useDataWithFilters`). Atoms per `.cursor/rules/reuse-ui-components.mdc`. |
| Image helpers | `normalizeRemoteImageSrc`, `validImageRegex`, placeholder `/images/single-bottle.webp`, `getPrimaryListingImage` for listings. |
| Pagination | `PaginationBar` unchanged. |
| i18n | Extend `messages/en.json` only when new UI chrome needs keys; sync locales via project skill. Prefer existing destash/collection keys. |
| Tests | No Collection UI unit tests today. Keep `lib/destash-form-*.test.ts`, `lib/user-inventory.test.ts`, allocation tests green. Add focused tests only for new pure helpers (e.g. owned/listed display formatting). |
| Unrelated consumers | Do not change Exchange/Seeking card motion grayscale globally; Collection opts into color-preserving classes only. |

---

## COMPONENT MAP

```text
app/[userSlug]/profile/my-scents/page.tsx
  └─ MyScentsPageClient
       ├─ TitleBanner (+ existing Add / Bulk / CSV in hero — may relocate Add into toolbar without changing banner chrome)
       ├─ PageWrapper
       │    ├─ BulkInventoryGrid / CsvImportPanel / WishlistDemand / SamplingQueue (preserve; not mockup focus)
       │    └─ MyScentsViewTabs
       │         ├─ inventory → CollectionTab
       │         │    ├─ toolbar (Add, SearchInput, Select sort/filters, ResultsViewToggle)
       │         │    ├─ OrnamentalFrame
       │         │    │    ├─ ul grid → CollectionGridItem (variant grid)
       │         │    │    └─ or list → CollectionGridItem/ListItem (variant list)
       │         │    └─ PaginationBar
       │         └─ listings → ListingsTab
       │              ├─ DecantSplitsPanel
       │              └─ MyListingsPanel → Edit opens DestashEditorRail
       └─ DestashEditorRail (new shell; hosts shared controller + DeStashForm)
            ├─ summary + Open full page
            ├─ DeStashForm (layout=rail)
            └─ shared DestashManager mutation path

app/[userSlug]/profile/my-scents/[perfumeId]/MySingleScentClient.tsx
  └─ DestashManager + DeStashForm (full page; same controller/form — deferred visual redesign)
```

### Exact file map (inspect baseline)

| File | Role today | Redesign role |
| --- | --- | --- |
| `app/.../my-scents/MyScentsPageClient.tsx` | Data, filters, pagination, tabs | Host layout mode + editor open state |
| `components/.../CollectionTab.tsx` | Search, filters, stats, grid only | Toolbar + grid/list + frame |
| `components/.../CollectionGridItem.tsx` | Image + name + listing badge | Richer card/row + CTAs; no grayscale |
| `components/.../MyScentsViewTabs.tsx` | Tab chrome | Unchanged API |
| `components/.../ListingsTab.tsx` | Splits + listings | Unchanged structure |
| `components/.../MyListingsPanel.tsx` | Listing cards; Edit → `#destash` link | Edit → rail; keep full-page link |
| `components/.../DestashManager/DestashManager.tsx` | Create/edit/pause/resume/remove | Shared controller for rail + page |
| `components/.../DeStashForm/DeStashForm.tsx` | Authoritative form + budget UI | Rail layout variant |
| `components/Organisms/SidePanelDrawer/...` | Shared rail/sheet shell | Filter drawer + DestashEditorRail |
| `components/Organisms/CatalogFilterDrawer/...` | Filter Clear/Apply wrapper | BC wrapper over SidePanelDrawer |
| `components/.../DestashEditorRail/...` | — | My Listings Edit destash rail |
| `hooks/useDestashEditSession.ts` | — | Shared edit/pause/save FormData path |
| `components/Atoms/OrnamentalFrame/...` | Gold frame | Results + rail chrome |
| `components/Molecules/ResultsViewToggle/...` | Grid/list toggle | Collection toolbar |
| `components/Molecules/PaginationBar/...` | Pagination | Reuse |
| `hooks/usePourableMlBudget.ts` / `lib/destash-form-budget.ts` | Budget | Reuse in form only |
| `lib/user-inventory.ts` | Bottle/listing helpers | Owned/listed display |
| `lib/destash-form-payload.ts` | Submit payload | Reuse |
| `messages/en.json` (+ es/fr/it) | Copy | Extend minimally |
| `utils/card-motion.ts` | Grayscale hover shared | Collection must opt out |

---

## STAGED CHECKLIST

### Stage 0 — Plan (this document) ✅

- [x] Read repo rules; confirm unrelated work preserved
- [x] Inspect Collection / Listings / Destash / drawer / OrnamentalFrame / toggle / pagination / volume / i18n / tests
- [x] Reference `docs/destash-improvements.md` without assuming unfinished work is done
- [x] Record reuse decisions, component map, readiness, visual contract
- [x] Hub link from `docs/README.md`
- [x] **No implementation**

### Stage 1 — Collection grid (toolbar + cards) ✅ (2026-10-20)

- [x] Toolbar below tabs: Add (existing modal), search, sort/house/amount filters, view toggle
- [x] `ResultsViewToggle` present (list enabled in Stage 2)
- [x] Results + toolbar wrapped in `OrnamentalFrame`
- [x] Grid columns: 1 / 2 (`md`) / 3 (`min-[1200px]`)
- [x] Color-preserving card images (`CARD_IMAGE_COLOR_HOVER_CLASS`)
- [x] Cards: house, name, bottle owned (unknown-safe), fragrance-pooled listed, View bottle, Create destash (`?list=1`)
- [x] Bottle-vs-fragrance grouping preserved; listed labeled as fragrance-level (hint/aria)
- [x] Search still filters full collection before pagination; page size unchanged
- [x] Bulk / CSV remain in hero; stats / demand / sampling preserved
- [x] Helper + tests: `lib/collection-volume-display.ts`
- [x] Preview: `/{userSlug}/profile/my-scents`
- [x] STOP for visual review

### Stage 2 — Collection list content ✅ (2026-10-20)

- [x] Enable list on `ResultsViewToggle`
- [x] Persist via URL `layout=list` (`utils/my-scents-params.ts`; `view` remains tab)
- [x] Grid/list share same filtered/sorted/paginated data; toggle does not reset `pg` or refetch
- [x] `CollectionGridItem` `variant="list"`: desktop row (thumb, name/house, inventory, actions); mobile stacked wrap (no horizontal table)
- [x] Stable keys (`userPerfume.id`), break-words names, color image fallbacks, focus-visible rings
- [x] No new grouping / inline bottle expansion
- [x] Preview: `/{userSlug}/profile/my-scents?layout=list`
- [x] STOP for visual review

### Stage 3 — Destash editor rail shell ✅ (2026-10-20)

- [x] Extract shared `SidePanelDrawer`; `CatalogFilterDrawer` wraps it (BC preserved)
- [x] Editor widths: 520px ≥1200px / 480px md / full-screen mobile; scrim + scroll lock; safe-area footer
- [x] My Listings **Edit** opens `DestashEditorRail` for selected listing
- [x] Same `DeStashForm` (`layout="rail"`) + `useDestashEditSession` (same FormData/API as DestashManager edit/pause)
- [x] Fixed header (Open full page → `#destash`) + footer Cancel / Save / Pause; body scrolls
- [x] One form id + external submit; duplicate-submit locks; pending/error preserved
- [x] Create destash from Collection card opens create-in-rail
- [x] Preview: `/{userSlug}/profile/my-scents?view=listings` → Edit
- [x] STOP for visual review

### Stage 4 — Rail interaction fixes ✅ (2026-10-20)

- [x] Load correct listing/saved values; keep draft when same id re-passed (`nextEditSnapshotTransition`)
- [x] Dirty discard confirm for Cancel / Escape / backdrop / close; Escape dismisses confirm first
- [x] Open full page confirms discard when dirty (no silent loss); clean navigate when pristine
- [x] Save/pause refresh parent listing rows via `onListingChange`; failed save keeps form draft/photos
- [x] Restore focus + scroll position on close (`SidePanelDrawer` fixed-body restore)
- [x] Editor does not mutate search/sort/`pg`/`view`/`layout` URL params
- [x] Explicit gone / forbidden when listing leaves scope or API says not found / 401–403
- [x] Owner auth remains server-side on `updateAvailableAmount` (`userId` match); client surfaces forbidden
- [x] Photo `Modal` marked `data-focus-trap-portal` for drawer trap compatibility
- [x] Focused tests: `lib/destash-editor-interactions.test.ts`
- [x] Direct full-page `#destash` URLs unchanged; no single-page redesign / create wizard
- [x] Preview: `/{userSlug}/profile/my-scents?view=listings` → Edit
- [x] STOP for visual review

### Stage 5 — Polish / verify ✅ (2026-10-20)

Verification against live local `/angelfodder/profile/my-scents` + unit fixtures. Theme/hero/nav take precedence over mockup colors (noir tokens; photos stay color via `CARD_IMAGE_COLOR_HOVER_CLASS`). No migrations / no production data edits / no push / no single-bottle redesign.

#### Quality gates (actual)

| Check | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | **Passed** (exit 0) | ~171s |
| Focused vitest (8 files) | **62 passed** | `collection-volume-display`, `destash-editor-interactions`, `my-scents-params`, inventory/destash/decant suites |
| ESLint (redesign-touched files) | **Passed** | Fixed unused `basePath` in `ListingCard`; exit 0 |
| `npm run i18n:diff` | **In sync** | es / fr / it |
| `npm run build` | **Blocked** | `prisma generate` **EPERM** renaming `query_engine-windows.dll.node` while `next dev` holds the engine (same class of lock as destash-improvements verify). Re-run build with dev stopped. |

#### Polish fix this stage

- Collection grid: `min-[1200px]:!grid-cols-3` so TW4 named `md:grid-cols-2` does not win after the arbitrary `min-[1200px]` utility (was stuck at **2** columns at 1440 until this).

#### Mockup layout pass (post Stage 5)

- Collection toolbar: single primary row **Add · Search · Sort · Grid/List**; house/ml filters under **More filters**
- Stats “at a glance” collapsed by default (not a dashboard above the mockup bar)
- Cards: portrait image, brand + name, `Owned X ml | Listed Y ml`, twin outline CTAs; status chip only when listed/partial
- List: Fragrance / Owned / Listed / Actions header + row grid
- Rail form: compact volume input, format/condition pair, photos always visible while editing; Cancel/Save then Pause

#### Breakpoint / layout matrix (signed-in)

| Width | Grid tracks (measured) | Notes vs mockups |
| --- | --- | --- |
| 1440 | **3** | After polish fix; toolbar Add + search + Grid/List; Bulk/CSV in hero; ornamental results |
| 1024 | **2** | Contract: 2 cols below 1200 |
| 820 | **2** | Color bottle photos; compact toolbar |
| 390 | **1** | Stacked card actions; mobile chrome |
| 320 | **1** | Usable; bottom nav pad `4.25rem` |

Screenshots saved under agent temp: `collection-verify-{1440,1024,820,390,320}-grid.png`, `collection-verify-1440-list.png`, `collection-verify-1440-edit-rail.png`, `collection-verify-390-edit-sheet.png`.

#### Checklist evidence

| Item | Result | Evidence |
| --- | --- | --- |
| Hero / nav / colors / photo colors | **Pass** | TitleBanner “Collection Archive”; global nav; `filter: none` on collection imgs; noir tokens (not mockup cream/hex) |
| 3/2/1 grid | **Pass** (after polish) | Measured tracks above |
| List + long names | **Pass** | `?layout=list`; `break-words` on house/name; ellipsis names render |
| Sparse / no results | **Pass** | Search `zzzz-no-match-xyz` → “No perfumes found” / try different |
| Search / sort / pagination / Grid↔List URL | **Pass** | `layout=list` preserved with `view=listings`; `Select` sort/house; page slice via `useResponsivePageSize` (6/8/16) + `pg` |
| Add / bulk / import | **Pass** | Toolbar “Add to Collection”; hero “Add Multiple” + “Import CSV” |
| View bottle | **Pass** | Href `…/my-scents/{userPerfumeId}`; dedicated page loads (Destash Management / Create Destash present) |
| Create destash | **Pass** (deferred rail) | Still `?list=1` full-page start (Stage 3 optional) |
| Edit listing → rail/sheet | **Pass** | Desktop dialog + `body` `position:fixed`; mobile 390×844 nearly full sheet; Hel selected |
| Save / cancel / pause / dirty / focus / scroll | **Partial** | Pristine Cancel closed rail + focus returned to Edit; scroll lock observed; **live Save/Pause/dirty-confirm not mutated** on this account (unit coverage in `destash-editor-interactions`) |
| Dropdowns / photo overlays / safe areas | **Partial** | Sort/House `Select` present; footer uses `safe-area-inset` + `keyboard-inset-height` in `SidePanelDrawer`; photo Modal portal attr not re-opened live |
| Dedicated bottle page | **Pass** | Unchanged single-scent surface; no redesign |
| Shared-component regressions / no duplicated business logic | **Pass** (code) | Rail uses `DeStashForm` + `useDestashEditSession`; `CatalogFilterDrawer` still wraps `SidePanelDrawer` |
| Bounded DOM / no DB perf claims | **Pass** | Client page slice ≤16 cards; unit fixtures for unknown/empty owned + editor transitions — **not** measured DB performance |

#### Visual diffs vs mockups (expected / theme wins)

- Product copy: **Collection Archive** / **Exchange Listings** / **Create Destash** / **Pause** language — not mockup “My Scents” / “Pause destash”.
- Photos: **color**, not mockup grayscale.
- Stats (“Collection at a glance”), Try next, house/ml filters retained (not in mockups).
- Mockup cream editor surface ignored; noir rail chrome used.

#### Isolated fixtures

- Unit: unknown owned (`full` / `partial`), empty owned → known zero, fragrance-pooled listed ml, editor discard/transition/failure classify.
- Live account has 4 bottles / 1 paused listing — no empty-collection or large-collection UI run; empty/sparse paths covered by CollectionTab empty + no-results branches + pageSize bound.

#### Components: reused vs new

| Kind | Pieces | Justification |
| --- | --- | --- |
| **Reused** | `OrnamentalFrame`, `SearchInput`, `Select`, `Input`, `Button`/`VooDooLink`, `ResultsViewToggle`, `PaginationBar`, `AddToCollectionModal`, `DeStashForm`, inventory/budget/payload libs | Existing atoms/molecules + destash business path |
| **New (redesign)** | `SidePanelDrawer` (shared shell), `DestashEditorRail` (editor chrome), `useDestashEditSession`, `lib/collection-volume-display`, `lib/destash-editor-interactions`, `CARD_IMAGE_COLOR_HOVER_CLASS` | Shell/controller/display helpers only — no parallel mutation stack |
| **Extended** | `CatalogFilterDrawer` → wraps `SidePanelDrawer`; `CollectionGridItem` `variant`; `DeStashForm` `layout="rail"`; `Modal` focus-trap portal attr | BC + rail hosting |

- [x] Manual smoke (signed-in) for grid/list/rail/sheet/view bottle/no-results
- [x] Recorded gates, blocked/partial interactions, visual diffs, reuse map
- [x] No migrations / no production data edits
- [x] STOP

---

## PREVIEW ROUTES

| Surface | Route |
| --- | --- |
| Collection (grid) | `/{userSlug}/profile/my-scents` |
| Collection (list) | `/{userSlug}/profile/my-scents?layout=list` |
| Listings | `/{userSlug}/profile/my-scents?view=listings` |
| Bottle + full destash | `/{userSlug}/profile/my-scents/{userPerfumeId}#destash` |

---

## EXACT COMMANDS

```bash
# Status / safety (no migrate / no push)
git status
npm run db:migrate:status

# Quality gates used by this repo
npm run typecheck
npm run test
npm run validate
npm run i18n:diff

# Focused destash / inventory suites (must stay green)
npx vitest run lib/user-inventory.test.ts lib/destash-form-budget.test.ts lib/destash-form-payload.test.ts lib/decant-split-ml.test.ts lib/listing-allocation-errors.test.ts

# Local preview
npm run dev
# then open /{userSlug}/profile/my-scents
```

After copy/key additions:

```bash
npm run i18n:sync
npm run i18n:diff
```

---

## LIMITATIONS / OPEN POINTS (for later implementation steps)

1. **Create destash from Collection** — opens `DestashEditorRail` in create mode; full-page `?list=1` remains via “Open full page”.
3. **Hero Add vs toolbar Add** — **Add** lives in the Collection toolbar (and empty state); Bulk/CSV remain in the hero child slot. Hero dimensions unchanged.
4. **Stats header** (`MyScentsStatsHeader`) — not in mockups; kept.
5. **Wishlist demand / sampling queue** — above tabs today; preserved.
6. **destash-improvements** operator smoke still open — redesign must not weaken budget/pause behavior while that smoke is unfinished.
7. **Single-bottle page redesign** — explicitly deferred; full-page destash must remain functional.
8. **Fragrance listed on cards** — uses pooled active `available` sum; labeled via hint/aria as fragrance-level (not bottle allocation).

---

## GUARDRAILS

- No `prisma db push`, no `migrate reset`, no production edits.
- No parallel destash form/validation/upload stack.
- No grayscale product imagery on Collection.
- No hero “improvements” from mockups.
- No assumed completion of unfinished destash-improvements checklist items.
