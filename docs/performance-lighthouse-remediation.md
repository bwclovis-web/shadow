# Lighthouse performance remediation

Production mobile Lighthouse is ~**84** (baseline before this work). This doc records audits, what we changed, and what remains.

See also: [performance-bfcache.md](./performance-bfcache.md) for back/forward cache limits.

## Audit summary

| Audit | Valid? | Safe to fix? | Expected impact | Do not do |
|-------|--------|--------------|-----------------|-----------|
| Hero image ~24 KiB | Yes | Yes | LCP / Performance (small–medium) | Remove `next/image`, drop `priority`, strip CSS filters for “perf” |
| Legacy polyfills ~14 KiB | Yes (waste on modern browsers) | Hard (Next framework chunk) | Small | Webpack alias to disable `next-polyfill-module` |
| Main-thread work ~3.2 s | Yes | Partially | TBT/INP (often diagnostic) | Remove global providers, CompareTray, i18n, view transitions |
| Long tasks | Yes | Partially | TBT/INP | Disable homepage client components entirely |
| bfcache / `no-store` document | Yes | Large architecture | bfcache, perceived nav | Break session/locale for all routes without design |

## Bundler (Turbopack)

Next.js **16** uses **Turbopack by default** for `next dev` and `next build` (no `--turbopack` flag). It improves build/HMR speed; it does **not** replace runtime fixes below (image bytes, hydration, polyfills, bfcache).

## Implemented changes

### Phase 1 — Quick wins

1. **Homepage hero LCP** (`app/home-client.tsx`): `quality={62}`, tighter `sizes`, WebP source `public/images/landing-new.webp` (PNG recompressed as fallback asset).
2. **Removed unused `getAllFeatures()`** on `/` (`app/page.tsx`, `app/home-client.tsx`).

### Phase 2 — Homepage main-thread

1. **Deferred below-fold feed** (`components/Molecules/DeferredBelowFold`): mounts seasonal/activity feed client bundles only when near viewport (`IntersectionObserver` + `rootMargin`).
2. **Nav logo LCP** (`GlobalNavigation.tsx`): `priority={false}` on `/` so hero stays primary LCP candidate.

### Phase 3 — Accepted overhead

- **Legacy polyfills** in Next `next-polyfill-module` chunk: document and re-check after Next minor upgrades; no webpack hacks.

### Phase 4 — Not implemented (epic)

- Marketing route group without cookie reads in layout for public pages (bfcache / static shell). See [performance-bfcache.md](./performance-bfcache.md).

## Lab hygiene

- Run Lighthouse on `/` **logged out**, clean profile (extensions inflate “Unattributable” long tasks).
- Compare 3 runs on preview/production after deploy.

## Verification checklist

1. Lighthouse mobile on `/`, logged out — Performance, LCP, “Improve image delivery”, main-thread diagnostics.
2. Visual check: hero at mobile + desktop (`quality={62}`).
3. Network: hero still served as WebP/AVIF via `/_next/image`.
4. Scroll homepage: feed sections appear when near viewport.
5. bfcache: expect **no change** until Phase 4.

## Local verification (2025-05-22)

- `npm run typecheck` — pass
- Hero source: `landing-new.webp` ~189 KiB on disk (was ~1 MiB PNG before resize); `/_next/image` output should be smaller with `quality={62}` and `sizes` cap
- Below-fold feed: no `ActivityFeedSection` / `SeasonalTrendingSection` JS until `DeferredBelowFold` intersects
- Homepage nav logo: `priority={false}` when `pathname === "/"`

## Metrics (fill in after deploy)

| Metric | Before | After | Date / URL |
|--------|--------|-------|------------|
| Performance score | ~84 | | |
| LCP | | | |
| TBT | | | |
| Hero transfer size (/_next/image) | ~41.6 KiB | | |

Run PageSpeed Insights or Lighthouse on `https://shadow-and-sillage.vercel.app/` (logged out) and update the table.
