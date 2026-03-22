# Compare tray (client, CF-001) and compare page (CF-002)

Short reference for reusing the compare list and UI in CF-002 (compare page) and CF-003 (shareable URLs).

## Shared constants

- **Module:** [`constants/compare.ts`](../constants/compare.ts)
- **`COMPARE_MAX_ITEMS`** — max perfumes in tray and in `GET /api/compare` (keep in sync everywhere).
- **`COMPARE_STORAGE_KEY`** — `localStorage` key; stable for CF-003.

## `compareStore`

- **Module:** [`hooks/compareStore.ts`](../hooks/compareStore.ts)
- **Hook:** `useCompareStore`
- **Persistence:** `localStorage` key from `COMPARE_STORAGE_KEY` in [`constants/compare.ts`](../constants/compare.ts). Only `items` is serialized (`partialize`).
- **Max items:** `COMPARE_MAX_ITEMS` = **3** (side-by-side intent in roadmap); re-exported from the store for existing imports.
- **Item shape (`CompareItem`):**
  - `id` — perfume id; unique key for dedupe.
  - `slug` — for future `/perfume/...` links on CF-002.
  - `name` — tray / UI label.
  - `image` — optional card image URL (same sources as `LinkCard`).
- **Actions:** `add`, `remove`, `toggle`, `clear`, and `isSelected(id)`. `toggle` removes if already selected; otherwise adds if under the cap. `add` updates fields if the same `id` is already present.

Until CF-003, treat this store as the **source of truth** for the selection set; hydrate or sync URLs later without renaming the storage key if possible.

## `CompareTray`

- **Module:** [`components/Molecules/CompareTray/CompareTray.tsx`](../components/Molecules/CompareTray/CompareTray.tsx)
- **Mount:** [`app/providers.tsx`](../app/providers.tsx) (inside `QueryClientProvider`, with app content; under `NextIntlClientProvider` from the root layout).
- **Stacking:** `z-50` fixed bottom bar so it sits above [`MobileNavigation`](../components/Molecules/MobileNavigation/MobileNavigation.tsx) (`z-30`) and modal layers (`z-20` / `z-30` in modal variants).
- **i18n:** `next-intl` namespace **`compare`** (see `messages/*.json`).
- **Composes:** [`Button`](../components/Atoms/Button/Button.tsx), [`PrefetchLink`](../components/Atoms/PrefetchLink/PrefetchLink.tsx) (primary **Open compare** → `/compare`), [`buttonVariants`](../components/Atoms/Button/button-variants.ts), [`styleMerge`](../utils/styleUtils.ts), `normalizeRemoteImageSrc` / `validImageRegex` + `next/image`, bottom-bar Tailwind aligned with [`MobileBottomNavigation`](../components/Molecules/MobileBottomNavigation/MobileBottomNavigation.tsx) (`bg-noir-dark/95`, `backdrop-blur-md`, `border-t border-noir-light/20`, `mobile-safe-bottom`).
- **Page spacing:** When `items.length > 0`, a `useLayoutEffect` + `ResizeObserver` sets `document.documentElement` style `--compare-tray-pad` to the tray’s pixel height (`COMPARE_TRAY_PAD_VAR` in code). [`app/globals.css`](../app/globals.css) applies `body { padding-bottom: var(--compare-tray-pad, 0px); }` so scrollable content clears the fixed tray. The variable is removed when the tray is empty.

## `PerfumeCompareToggle`

- **Module:** [`components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle.tsx`](../components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle.tsx)
- **Props:** `item: CompareItem` (same shape as the store).
- **Placement:** Rendered as a **sibling** of `PrefetchLink` on perfume [`LinkCard`](../components/Organisms/LinkCard/LinkCard.tsx) tiles (not inside the link). Click uses `preventDefault` + `stopPropagation` so navigation does not fire.
- **A11y:** `aria-pressed` for selected state; `title` + `aria-label` from `compare` messages (including tray-full).

## Compare page (`/compare`, CF-002)

- **Route:** [`app/compare/page.tsx`](../app/compare/page.tsx) (metadata) + [`ComparePageClient.tsx`](../app/compare/ComparePageClient.tsx).
- **Data:** Reads tray order from `useCompareStore`, fetches via [`useComparePayload`](../hooks/useComparePayload.ts) → [`lib/queries/compare.ts`](../lib/queries/compare.ts) → **`GET /api/compare`**.
- **UI:** [`TitleBanner`](../components/Organisms/TitleBanner/TitleBanner.tsx), `inner-container`, `max-w-6xl` grid; reuses [`PerfumeNotes`](../components/Containers/Perfume/PerfumeNotes/PerfumeNotes.tsx); read-only ratings via [`PerfumeAggregateRatingsSummary`](../components/Molecules/PerfumeAggregateRatingsSummary/PerfumeAggregateRatingsSummary.tsx) (same i18n categories as the detail rating UI).

## `GET /api/compare` (CF-003-ready)

- **Module:** [`app/api/compare/route.ts`](../app/api/compare/route.ts)
- **Query:** `ids` — comma-separated or repeated `ids=` perfume ids (trimmed, deduped). Empty → `{ "perfumes": [] }`. More than `COMPARE_MAX_ITEMS` → **400**.
- **Server:** [`getComparePayload`](../models/compare.server.ts) loads perfume + notes (same transform as detail), aggregate ratings, and exchange listing counts (`userPerfume` with `available != "0"`), **preserving request order**.

For **CF-003**, hydrate selection from the URL, then call this endpoint with the same ordered id list (do not rename `COMPARE_STORAGE_KEY` if the tray also syncs from URL).

## Related

- Roadmap: Compare Mode in [`CUSTOMER_FEATURES_BACKLOG.md`](./CUSTOMER_FEATURES_BACKLOG.md).
