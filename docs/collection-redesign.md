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
| List | Dense rows: thumb + brand/name + owned/listed + actions; same data and actions as grid. |
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
| `components/Organisms/CatalogFilterDrawer/...` | Filter drawer primitive | Pattern reference / shared a11y |
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
- [x] `ResultsViewToggle` present; **list disabled** until list-view step (`disabledViews`)
- [x] Results + toolbar wrapped in `OrnamentalFrame`
- [x] Grid columns: 1 / 2 (`md`) / 3 (`min-[1200px]`)
- [x] Color-preserving card images (`CARD_IMAGE_COLOR_HOVER_CLASS`)
- [x] Cards: house, name, bottle owned (unknown-safe), fragrance-pooled listed, View bottle, Create destash (`?list=1`)
- [x] Bottle-vs-fragrance grouping preserved; listed labeled as fragrance-level (hint/aria)
- [x] Search still filters full collection before pagination; page size unchanged
- [x] Bulk / CSV remain in hero; stats / demand / sampling preserved
- [x] Helper + tests: `lib/collection-volume-display.ts`
- [ ] List view rows (deferred)
- [ ] Layout URL param for list (deferred with list)
- [ ] Preview: `/{userSlug}/profile/my-scents`
- [x] STOP for visual review

### Stage 2 — Collection list content

- [ ] Enable list on `ResultsViewToggle` + layout URL param
- [ ] List variant/rows: same data and actions as grid
- [ ] Honest multi-bottle listed display (pooled; no invented bottle ledger) — already on grid
- [ ] STOP for visual review

### Stage 3 — Destash editor rail shell

- [ ] Add right-rail / mobile sheet shell (a11y: focus trap, Escape, restore focus, scroll lock) reusing CatalogFilterDrawer patterns
- [ ] Open from My Listings Edit; **Open full page** → `#destash`
- [ ] Host **same** `DeStashForm` + DestashManager controller path (create + edit)
- [ ] Optional: Create destash from Collection card opens create-in-rail with perfume/bottle context
- [ ] Sticky Cancel / Save / Pause using existing actions
- [ ] STOP for visual review

### Stage 4 — Polish, i18n, verify

- [ ] Minimal new i18n keys; run locale sync
- [ ] Focused tests for any new pure helpers; keep destash/allocation suites green
- [ ] Manual smoke: grid/list, pagination, edit rail save/pause, full-page fallback, create destash
- [ ] No migrations / no production data edits

---

## PREVIEW ROUTES

| Surface | Route |
| --- | --- |
| Collection | `/{userSlug}/profile/my-scents` |
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

1. **List view** — toolbar toggle shows list disabled (`listViewPending`); grid-only until Stage 2.
2. **Create destash from Collection** — currently navigates to bottle page `?list=1` (existing auto-start create). Rail editor is a later stage.
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
