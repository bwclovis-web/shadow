# Catalog redesign: The Archive and Behind the Bottle

Implementation contract for adapting the perfume catalog (`/the-archive`, `/the-archive/[letter]`) and the house catalog (`/houses`) to the supplied desktop, tablet (820px), and mobile (390px) mockups. This is a layout and browsing change, not a data-model redesign. No migration is required.

## Reference priorities

When sources disagree, resolve in this order:

1. **Written contract (this document and the rules below)** — wins over everything for functionality and data.
2. **Actual codebase** — authoritative for what data exists, routes, navigation, and shared components.
3. **Mockups** — authoritative for layout, spacing, hierarchy, grid/list presentation, and responsive filter behavior.
4. **Current-page screenshots** — authoritative for the hero imagery and brand styling to preserve.

Mockup counts, product imagery, categories, and metadata are illustrative. They must never be hardcoded or fabricated; every number, name, image, and label on the page comes from real data or existing translations.

## Rules for this release

- Preserve the existing heroes (`TitleBanner` with `/images/new/vault.webp` and `/images/new/behind.webp`, unchanged copy) and the burgundy / gold / charcoal Noir theme.
- Use the actual Prisma `HouseType` values: `niche`, `designer`, `indie`, `celebrity`, `drugstore`, labelled from `allHouses.houseTypes.*`.
- Use searchable house and note selectors (typeahead + chips), not long checkbox lists.
- Omit concentration and scent-family filters in this release.
- Preserve the existing global navigation (`GlobalNavigation`, `MobileNavigation`, `MobileBottomNavigation`) rather than copying the mockups' generated labels.

## Guardrails

- Reuse atoms and organisms (`Select`, `Button`, `CheckBox`, `SearchBar`, `TagSearch`, `FilterPanelSection`, `PaginationBar`, `PerfumeCompareToggle`, `PrefetchLink`). Shared components were extended with optional props, never forked.
- Prisma reads live in `models/*.server.ts`; pages stay server components and pass serialisable DTOs to client components.
- Global `h1`–`h3` rules are unlayered, so catalog heading sizes use `!` utilities. No global CSS changed.
- No schema change and no destructive data operation.

## Architecture

URL-driven, server-rendered catalog (same pattern as the Exchange discovery filters). Every browse state is a shareable URL; the client only builds hrefs and calls `router.push(href, { scroll: false })` inside a transition.

| Concern | Archive | Houses |
| --- | --- | --- |
| Page | `app/the-archive/page.tsx`, `app/the-archive/[letter]/page.tsx` | `app/houses/page.tsx` |
| Server loader | `app/the-archive/archive-catalog.server.ts` | `getHouseCatalogPage` in `models/house.server.ts` |
| Query | `getArchiveCatalogPage` in `models/perfume-catalog.server.ts` | `getHouseCatalogPage` |
| Client | `app/the-archive/TheArchiveClient.tsx` | `app/houses/AllHousesClient.tsx` |
| Filter fields | `components/Containers/Catalog/ArchiveFilterFields.tsx` | `components/Containers/Catalog/HouseTypeFilterFields.tsx` |

Shared pieces:

- `utils/catalog-params.ts` — parse/build URL state, sorts, views, house types, page size. Unit tested in `utils/catalog-params.test.ts`.
- `hooks/useCatalogNavigation.ts` — pending state plus an optimistic copy of the requested state (`useOptimistic`), so sort, view, letter, and the filter badge update immediately while the server render loads.
- `components/Organisms/CatalogToolbar` — search, sort, filters button with count badge, grid/list toggle, compact A–Z.
- `components/Organisms/CatalogResults` — "Showing X of Y" heading, grid or list, pagination, empty state.
- `components/Molecules/CatalogItem` — `CatalogItemCard` (grid) and `CatalogItemRow` (list).
- `components/Organisms/CatalogFilterDrawer` — bottom sheet below `md`, right-hand panel from `md`.

### URL contract

| Key | Values | Pages |
| --- | --- | --- |
| path `/the-archive/[letter]` | `a`–`z` (lowercase) | Archive |
| `letter` | `a`–`z` | Houses |
| `house` | comma-separated house ids (max 20) | Archive |
| `notes` | comma-separated note ids (max 20) | Archive |
| `season` | `winter,spring,summer,fall` | Archive |
| `type` | comma-separated `HouseType` values | Houses |
| `sort` | `created-desc` (default), `created-asc`, `name-asc`, `name-desc`; Houses also `type-asc` | both |
| `view` | `grid` (default), `list` | both |
| `pg` | page number, 1-based | both |
| `q` | name search | Archive |

Defaults are omitted from generated URLs. Unknown values, malformed ids, and out-of-range pages fall back to defaults; a page past the end is clamped to the last page on the server.

## Data rules

- Page size is 24 (divisible by 2, 3, and 4, so every grid breakpoint ends on a full row). Totals are real `count` queries.
- Archive filters reuse the Exchange discovery semantics: house matches `perfumeHouseId in`; notes match if the perfume has **any** selected note; seasons match if the perfume has at least one community season vote for **any** selected season. Filters combine with AND across groups.
- Selected house and note ids are resolved to names on the server; ids that no longer exist are dropped before querying.
- Houses list only houses with at least one perfume (unchanged visibility). `type-asc` orders by type enum, then name.
- Search mode (`?q=`) keeps the existing relevance-ranked `searchPerfumeByNameForViewer` (max 40 results). Sort and filters are hidden; the view toggle keeps `q`; choosing a letter, sort, or filter returns to browsing. Search pages stay `noindex, follow`.
- Pending perfumes: browsing does not filter `isPending` (unchanged) and cards show the review badge; search hides other users' pending perfumes (unchanged). This inconsistency predates the redesign.
- The house typeahead uses `/api/perfume-houses`, which includes houses without perfumes; selecting one yields an honest empty result.

## Layout contract

- **Toolbar** (bordered panel under the hero): below `lg`, row one is search + grid/list toggle and row two is sort (fills remaining width) + Filters; from `lg` everything sits on one row. Compact A–Z below: one horizontally scrolling row with a fade below `lg`, a two-row 14-column grid from `lg` with "All" first.
- **Results heading**: "Showing {shown} of {total} perfumes/houses" (serif `h2`), with a live "Updating results…" status during navigation.
- **Grid**: 2 columns → 3 at `md` → 4 at `xl`. Cards are a 4:3 image over a burgundy panel with serif title and house/type subtitle; compare toggle overlays the image (Archive only).
- **List**: thumbnail, title, subtitle, "View perfume/house →" from `md`, chevron on mobile.
- **Filter drawer**: draft state until "Apply filters (n)"; "Clear all" clears the draft only. Focus trap, Escape to close, body scroll lock, focus returns to the Filters button. Archive sections: House (typeahead), Notes (typeahead), Season (four checkboxes). Houses section: Type ("All" + five types).
- **Card links** append `?letter=` when a letter is selected so detail pages can link back.

## Mockup and implementation mismatches

- Tablet mockup heads results with "Recently added"; desktop and mobile use "Showing X of Y". All widths use the count heading.
- Mockup suggests 12 items per page; the catalog uses 24 so every grid breakpoint fills complete rows.
- Mockup Houses desktop marks list view "(optional)"; both catalogs default to grid with list available.
- Mockup filter chips above results are not shown; selected values appear as chips inside the drawer and as the count on the Filters button.
- Mockup concentration and scent-family filters are omitted by rule.
- Season labels come from existing translations (`singlePerfume.seasonVote.season`), so "fall" displays as "Autumn".
- Mockup counts, bottle images, house names, and categories are illustrative; real data is shown, with `/images/single-bottle.webp` and `/images/house-soon.webp` as fallbacks.
- `allHouses.sortOptions.type-asc` now reads "By House Type".
- Mockup navigation labels differ from the localized global navigation, which is kept.

## Removed

Superseded by the server-rendered catalog and deleted (no remaining references): `components/Organisms/DataDisplaySection`, `components/Organisms/DataFilters`, `hooks/useAlphabeticalBrowserState.ts`, `hooks/useInfiniteHouses.ts`, `hooks/useSyncPaginationUrl.ts`, and `useInfinitePerfumesByLetter`. The `/api/perfumes-by-letter` and `/api/houses-by-letter-paginated` routes are kept for other callers. The default (large) `AlphabeticalNav` variant and `lib/utils/prefetch.ts` remain but are no longer used by these pages.

## Shared component changes

- `AlphabeticalNav`: `variant="compact"`, `ariaLabel`, `onLetterHover`.
- `TagSearch`: optional `searchFn`, `messages`, `placeholder`, `emptyLabel`, `searchLabelClassName`.
- `FilterPanelSection`: optional `collapsible` / `defaultOpen` (`<details>`).
- `RemovableChip`: the remove button no longer inherits the `Button` atom's mobile `w-full`, which had collapsed chip labels to zero width below `md` everywhere chips are used.

## Copy

New keys in `messages/en.json`, synced to `es`, `fr`, `it` (`npm run i18n:diff` passes):

- `catalog.*` — toolbar labels, drawer buttons, typeahead states, `updating`, `clearFilters`.
- `allPerfumes.*` — `searchPlaceholder`, `resultsCount`, `emptyFiltered`, `emptyLetter`, `viewAction`, `filters.*`.
- `allHouses.*` — `searchPlaceholder`, `resultsCount`, `emptyFiltered`, `emptyLetter`, `viewAction`, `filters.*`.
- Removed `allPerfumes.featuredHeading`.

## Checklist

- [x] Server-rendered, URL-driven Archive and Houses catalogs with real totals and pagination.
- [x] Searchable house and note selectors; season checkboxes; real house types.
- [x] Responsive drawer (bottom sheet / side panel) with focus management.
- [x] Grid and list views for both catalogs.
- [x] Heroes, theme, and global navigation preserved.
- [x] Copy added and synced for all locales.
- [x] Unit tests for URL state and the Archive query.
- [x] Browser review at 1440, 820, and 390px.
- [ ] Signed-in review (pending-perfume visibility in search, compare tray).
- [ ] Optional follow-up: active-filter chips above results.

## Verification findings (2026-10-18)

Local dev server, guest session, English.

| Command | Result |
| --- | --- |
| `tsc --noEmit` | Pass |
| ESLint on changed files | Pass |
| `npm run i18n:diff` | Pass |
| Vitest (PostCSS disabled via temporary config, removed afterwards) | `catalog-params` 15 tests, `perfume-catalog.server` 3 tests: pass |

Browser checks:

- 1440px: one-row toolbar, two-row A–Z, four-column grid, drawer as 416px right panel; house typeahead → chip → Apply → `?house=…`, "Showing 17 of 17", focus back on "Filters, 1 applied".
- 820px: two-row toolbar, Houses list view with type labels, Type drawer as right panel; `type=niche,designer` → 1,310 houses; `type-asc` last page lists Designer houses alphabetically with 14 items.
- 390px: two-row toolbar (sort shows "Recently Added" in full), scrolling A–Z, two-column grid, bottom sheet at 85dvh with scroll lock; Escape closes and restores focus.
- Optimistic UI: the sort select keeps the new value while "Updating results…" shows.
- Search mode `?q=rose`: 40 results, sort and filters hidden, `view=list` preserved, `noindex, follow`.
- Edge URLs: `pg=99999` clamps to the last page; malformed ids and bogus `sort`/`view`/`pg` fall back to defaults; zero matches render the empty state.

Fixed during verification: duplicate "Search Houses/Notes" labels in the drawer (now screen-reader only), squeezed mobile sort select, invisible chip labels on mobile (`RemovableChip`), sort select snapping back during navigation, and unordered names within `type-asc`.

Pre-existing issues noticed (not changed):

- One house image on R2 is an SVG served with a `.jpg` name; `next/image` refuses it (`dangerouslyAllowSVG` is off). Same behavior as the previous `LinkCard`.
- `npm run test` cannot load `postcss.config.mjs`; `TagSearch` and `AlphabeticalNav` tests fail because they render without a `NextIntlClientProvider` (both components already used `useTranslations` before this work).
