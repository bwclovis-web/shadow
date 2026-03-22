# Compare tray (client, CF-001)

Short reference for reusing the compare list and UI in CF-002 (compare page) and CF-003 (shareable URLs).

## `compareStore`

- **Module:** [`hooks/compareStore.ts`](../hooks/compareStore.ts)
- **Hook:** `useCompareStore`
- **Persistence:** `localStorage` key `shadows-compare-tray` (`COMPARE_STORAGE_KEY`). Only `items` is serialized (`partialize`).
- **Max items:** `COMPARE_MAX_ITEMS` = **3** (side-by-side intent in roadmap).
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
- **Composes:** [`Button`](../components/Atoms/Button/Button.tsx), [`styleMerge`](../utils/styleUtils.ts), `normalizeRemoteImageSrc` / `validImageRegex` + `next/image`, bottom-bar Tailwind aligned with [`MobileBottomNavigation`](../components/Molecules/MobileBottomNavigation/MobileBottomNavigation.tsx) (`bg-noir-dark/95`, `backdrop-blur-md`, `border-t border-noir-light/20`, `mobile-safe-bottom`).
- **Page spacing:** When `items.length > 0`, a `useLayoutEffect` + `ResizeObserver` sets `document.documentElement` style `--compare-tray-pad` to the tray’s pixel height (`COMPARE_TRAY_PAD_VAR` in code). [`app/globals.css`](../app/globals.css) applies `body { padding-bottom: var(--compare-tray-pad, 0px); }` so scrollable content clears the fixed tray. The variable is removed when the tray is empty.

## `PerfumeCompareToggle`

- **Module:** [`components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle.tsx`](../components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle.tsx)
- **Props:** `item: CompareItem` (same shape as the store).
- **Placement:** Rendered as a **sibling** of `PrefetchLink` on perfume [`LinkCard`](../components/Organisms/LinkCard/LinkCard.tsx) tiles (not inside the link). Click uses `preventDefault` + `stopPropagation` so navigation does not fire.
- **A11y:** `aria-pressed` for selected state; `title` + `aria-label` from `compare` messages (including tray-full).

## Related

- Roadmap: Compare Mode in [`CUSTOMER_FEATURES_BACKLOG.md`](./CUSTOMER_FEATURES_BACKLOG.md).
