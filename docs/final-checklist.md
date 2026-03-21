# Shadows — Final Checklist

> Comprehensive audit of the Next.js / Tailwind / Zustand codebase.
> Generated 2026-03-09.  
> Priority: **P0** = must-fix before launch, **P1** = strongly recommended, **P2** = nice-to-have / iterative.

---

## Table of Contents

1. [Security](#1-security)
2. [Performance](#2-performance)
3. [Next.js Best Practices](#3-nextjs-best-practices)
4. [Code Quality & Optimization](#4-code-quality--optimization)
5. [Observability & Operations](#5-observability--operations)
6. [Implementation Checklist](#6-implementation-checklist)

---

## 1. Security

### 1.1 API Authentication Gaps

| Issue | Route | Priority |
|-------|-------|----------|
| `/api/data-quality-houses` returns all houses (including email, phone, address) with **no auth check** | `app/api/data-quality-houses/route.ts` | **P0** |
| ~~`/api/cron/cleanup-messages` ran without auth if `CRON_SECRET` was unset~~ Fixed: returns 500 if unset | `app/api/cron/cleanup-messages/route.ts` | **P0** ✅ |
| ~~Admin scraper routes (`/api/admin/scraper/import`, `/run`) lack CSRF protection~~ Fixed: `requireCSRF` in POST | `app/api/admin/scraper/import/route.ts`, `run/route.ts` | **P1** ✅ |
| ~~`/api/ratings` POST is missing CSRF protection~~ Fixed: `requireCSRF` in POST | `app/api/ratings/route.ts` | **P1** ✅ |

**Fixes (non-breaking):**

- Add `requireAdminOrEditorApi` to `/api/data-quality-houses`.
- ~~Make `/api/cron/cleanup-messages` fail early when `CRON_SECRET` is not set.~~ **Done.**
- CSRF (`requireCSRF`) on `/api/ratings` POST and admin scraper import/run — **Done.**

### 1.2 Input Validation

| Issue | Priority |
|-------|----------|
| ~~No query-string length limits on `/api/getTag`, `/api/perfume-houses`, `/api/perfume` (DoS vector)~~ **Done:** `parseRequiredAutocompleteQuery` / `parseOptionalAutocompleteQuery` (200 chars) in `api-route-helpers.server.ts` | **P1** ✅ |
| ~~`traderId` / `perfumeId` / related ids not validated before DB queries~~ **Done:** `isValidPrismaRecordId` in `utils/prisma-record-id.ts` (Prisma `cuid` + UUID); applied to `/api/trader-feedback`, `/api/ratings`, `/api/reviews`, `/api/user-perfumes`, and wishlist Zod | **P1** ✅ |
| ~~`sortBy` in `/api/perfumeSortLoader` is cast without validation~~ **Done:** allowlisted `sortBy`, validated `cursor` / `take` (`app/api/perfumeSortLoader/route.ts`) | **P2** ✅ |

**Fixes (non-breaking):**

- Clamp query params to a max length (e.g. 200 chars) at the start of each handler.
- ~~Validate IDs against a UUID regex before passing to Prisma.~~ **Done** (see `isValidPrismaRecordId` — schema uses `cuid()`, not only UUID).

### 1.3 Rate Limiting

`/api/contact-trader`, `/api/auth/refresh`, sign-in (`signInAction`), sign-up (`signUpAction`), `/api/change-password`, `/api/reviews` POST, and `/api/ratings` POST are rate-limited using `validateRateLimit` (in-memory `Map`). The store still does not work across multiple instances.

| What to rate-limit | Priority |
|--------------------|----------|
| `/api/auth/refresh`, sign-in, sign-up | **P0** (implemented) |
| ~~`/api/change-password`~~ | **P1** ✅ |
| ~~`/api/reviews` POST, `/api/ratings` POST~~ | **P1** ✅ |
| `/api/wishlist` POST | **P2** |

**Fixes (non-breaking):**

- Auth: `getAuthRateLimits()` — refresh defaults to 60 req / 60s per client IP; sign-in defaults to 5 req / min per IP (`AUTH_*` env vars in `rate-limit-config.server.ts`). Sign-up uses existing signup limits (`SIGNUP_RATE_LIMIT_*`).
- User mutations: `getUserMutationRateLimits()` — per authenticated user: change-password (default 5 / 60 min), reviews POST (40 / 60 min), ratings POST (120 / 15 min); tune via `CHANGE_PASSWORD_*`, `REVIEWS_POST_*`, `RATINGS_POST_*` in `rate-limit-config.server.ts`.
- For production multi-instance deployments, swap the in-memory store with a Redis-backed store (e.g. `@upstash/ratelimit`) — this is a **breaking change** if there's no Redis yet; flag it for post-launch.

### 1.4 Middleware

There is **no root `middleware.ts`**. Adding one is optional but recommended.

**Fixes (non-breaking):**

- Add `middleware.ts` to set security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`) on every response. `helmet` is already a dependency but unused in Next.js context.
- Optionally add global auth gating for `/admin/*` routes in middleware for defense-in-depth.

### 1.5 Cookie & Token Hardening

- **Auth cookies (`accessToken`, `refreshToken`):** `getAuthCookieFlags()` in `utils/security/auth-cookie.server.ts` sets **HttpOnly** always; **Secure** and **SameSite=Strict** when `NODE_ENV === "production"`; in local dev over HTTP, **Secure=false** and **SameSite=lax** so cookies still work. Applied from sign-in / sign-up actions, `/api/auth/refresh`, and `/api/log-out`.
- Confirm `JWT_SECRET` is at least 32 characters (`.env.example` documents this).

---

## 2. Performance

### 2.1 Database & Query Optimization

| Issue | Location | Priority |
|-------|----------|----------|
| ~~`getUserByProfileSlug` loads **all users** into memory~~ **Fixed:** indexed `profileSlug` query | `models/user.query.ts` | **P0** ✅ |
| ~~`getAllPerfumes` has a hard cap of 5000 rows with no cursor pagination~~ **Done:** cursor + `take` (clamped); `fetchAllPerfumesForCatalog` stitches up to 5000 for `/api/user-perfumes` | `models/perfume.server.ts` | **P1** ✅ |
| ~~`getAllPerfumesWithOptions` has no `take` limit~~ **Done:** cursor pagination, default/max `take` in `perfume-cursor-order.server.ts` | `models/perfume.server.ts` | **P1** ✅ |
| `getAvailablePerfumesForDecanting` has no pagination | `models/perfume.server.ts` | **P2** |
| Scraper import uploads images to R2 sequentially in a `for` loop | `app/api/admin/scraper/import/route.ts` | **P1** |
| Note resolution in CSV import calls `getOrCreateNote` + `upsertNoteRelation` per note sequentially | `lib/import-perfume-csv.ts` | **P2** |
| ~~Scraper import creates its own `PrismaClient` instead of reusing the singleton~~ **Fixed:** shared `prisma` from `lib/db.ts` | `app/api/admin/scraper/import/route.ts` | **P1** ✅ |

**Fixes (non-breaking):**

- ~~**`getUserByProfileSlug`**: Add a `slug` column…~~ **Done** (indexed column / direct query).
- ~~**`getAllPerfumes` / `getAllPerfumesWithOptions`**: Add cursor-based pagination…~~ **Done:** `getAllPerfumes` / `getAllPerfumesWithOptions` return `{ items, nextCursor }`; `/api/perfumeSortLoader` returns `{ perfumes, nextCursor }` (breaking); `type-asc` sorts by `perfumeHouse.type`.
- **Scraper R2 uploads**: Use `Promise.all` with a concurrency limiter (e.g. `p-limit(5)`).
- **Note resolution**: Batch `findMany({ where: { name: { in: [...] } } })` first, then only create missing notes.
- ~~**Prisma singleton**: Replace `new PrismaClient()` in the import route with the shared `prisma` from `lib/db.ts`.~~ **Done** (do not call `$disconnect()` on the shared client).

### 2.2 Caching

| What | Current State | Recommendation | Priority |
|------|---------------|----------------|----------|
| Perfume/house by slug | `unstable_cache` with 3600s TTL | Good — keep | — |
| `getAllPerfumes`, `getAllPerfumesWithOptions`, `getAllHouses` | `unstable_cache` (3600s) + tags `perfume` / `house` | Invalidate via `revalidatePerfumeDataCache` / `revalidateHouseDataCache` after writes | **P1** ✅ |
| Tag invalidation on mutations | `revalidateTag("perfume")` / `revalidateTag("house")` from server actions + delete API routes | Good — keep | — |
| The Vault initial data | Fetched entirely on client | Server-render the first page of perfumes and pass as `initialData` | **P1** |
| API GET routes | No `Cache-Control` headers | Add `s-maxage` / `stale-while-revalidate` headers for public data endpoints | **P2** |

### 2.3 Client Bundle

| Issue | Priority |
|-------|----------|
| `react-icons` — importing from barrel files pulls large chunks; prefer importing from sub-paths (e.g. `react-icons/fi`) | **P1** ✅ |
| `chart.js` is dynamically imported in `DataQualityClient` — good, no action needed | — |
| GSAP — `app/home-client.tsx` uses `import("gsap")` inside `useEffect`; `NoirIcon` / `rangeSliderUtils` also dynamic-import GSAP. Unused `TitleBannerAnimator` removed. | **P2** ✅ |
| `@tanstack/react-query` wraps the entire app in `providers.tsx` — acceptable, but ensure `ReactQueryDevtools` is tree-shaken in production (it's already lazy with `ssr: false`) | — |

### 2.4 Images

Image handling is solid — `next/image` is used consistently. No raw `<img>` tags in production code. Custom preloading via `useImagePreloader` is fine.

- Confirm `next.config.ts` `images.formats` includes `['image/avif', 'image/webp']` — it does. ✅
- Consider adding `priority` prop to above-the-fold hero images if not already set.

---

## 3. Next.js Best Practices

### 3.1 Server vs Client Components

| Component | Issue | Recommendation | Priority |
|-----------|-------|----------------|----------|
| `app/not-found.tsx` | Marked `"use client"` but only uses `useTranslations` + `Link` | Convert to server component using `next-intl` server APIs | **P2** |
| `components/Atoms/Button/` | `Button.tsx` is server-safe; `VooDooLink.tsx` is `"use client"` (`useTransitionRouter` + `Link`) | Done | **P2** ✅ |
| `AboutUsContent.tsx`, `HowWeWorkContent.tsx` | Replaced misnamed `*Client` server modules | Done | **P2** ✅ |
| The Vault page | Passes `initialPerfumes={[]}` — all data client-fetched | Fetch first page on server and pass as `initialData` for SSR + hydration | **P1** |
| `DataQualityClient` | Uses `useQuery` for initial data | Could use server component for initial fetch, hydrate on client | **P2** |

### 3.2 Loading & Error Boundaries

Only 3 `loading.tsx` files exist (root, exchange, perfume detail). Many routes show no loading UI during navigation.

**Recommended `loading.tsx` files (non-breaking):**

| Route | Priority |
|-------|----------|
| `app/admin/loading.tsx` | **P1** |
| `app/messages/loading.tsx` | **P1** |
| `app/[userSlug]/profile/loading.tsx` | **P1** |
| `app/the-vault/loading.tsx` | **P1** |
| `app/houses/loading.tsx` | **P2** |

**Recommended `error.tsx` files:**

Currently only the root `app/error.tsx` exists. Route-level error boundaries prevent a single error from crashing the whole page.

| Route | Priority |
|-------|----------|
| `app/admin/error.tsx` | **P1** |
| `app/messages/error.tsx` | **P1** |
| `app/perfume/[perfumeSlug]/error.tsx` | **P2** |

### 3.3 Forms

The codebase mixes server actions (sign-in, sign-up, create perfume/house) with client `fetch` (change password, contact trader, alerts). This is fine — but consider:

- ~~Migrating `ChangePasswordForm` and `ContactUsClient` to server actions~~ **Done:** `ChangePasswordForm` uses `changePasswordAction` (`app/[userSlug]/profile/change-password/actions.ts`). Contact submissions use `submitPendingPerfumeFromContactAction` / `submitPendingHouseFromContactAction` (`app/contact-us/actions.ts`) via `PendingSubmissionModal` + Conform forms (**P2**).
- Ensuring all `fetch`-based mutations include CSRF tokens (most do already).

### 3.4 Metadata & SEO

- Each `app/**/page.tsx` exports `generateMetadata` (or root `app/layout.tsx` static `metadata`). Added for messages, admin stats JSON pages, legacy `/behind-the-bottle`, home, auth, scraper, and thread titles with `directMessages` i18n.
- ~~Add `robots.txt` and `sitemap.xml`~~ **Done:** `app/robots.ts` and `app/sitemap.ts`.

---

## 4. Code Quality & Optimization

### 4.1 TypeScript — Eliminate `any`

Over 30 usages of `any` across models and components. Key files:

| File | Instances |
|------|-----------|
| `models/user.server.ts` | `existingPerfume: any`, `updateData: any`, `comment: any` |
| `lib/mutations/tags.ts` | `data?: any` |
| `lib/mutations/houses.ts` | `(old: any)`, `(house: any)` in `setQueryData` |
| `lib/queries/perfumes.ts`, `houses.ts`, `user.ts` | `any[]` in response types |
| `components/Containers/VirtualScrollDemo` | `any` |
| `components/Containers/WishlistItemCard` | `any` |
| `components/Organisms/SearchBar` | `any` |

**Fix:** Replace with Prisma-generated types or dedicated interfaces. This is non-breaking and improves maintainability.

**Priority:** **P1** (most can be done incrementally)

### 4.2 Code Duplication

| Duplicated Logic | Where | Fix |
|------------------|-------|-----|
| Slug generation (`findUniqueSlug`) | `perfume.server.ts`, `house.server.ts`, `import-perfume-csv.ts` | Extract to `utils/slug.ts` |
| Three-tier search (exact → startsWith → contains) | `searchPerfumeByName`, `searchPerfumeHouseByName` | Extract a generic `tieredSearch` helper |
| Prisma select shapes (`perfumeHouse: { select: { id, name, slug, type } }`) | Multiple model files | Define shared select constants in `lib/prisma-selects.ts` |
| R2 migration logic | `migrateHouseImagesToR2`, `migratePerfumeImagesToR2` | Generalize into a single `migrateEntityImagesToR2` function |

**Priority:** **P2** (non-breaking, reduces maintenance burden)

### 4.3 Error Handling Consistency

`utils/errorHandling.patterns.ts` provides excellent helpers (`withDatabaseErrorHandling`, `assertValid`, `safeAsync`, `withRetry`), but they're only used in a few places.

**Fix:** Gradually adopt `withApiErrorHandling` or `safeAsync` in API routes that currently use ad-hoc try/catch. This standardizes error responses and logging.

**Priority:** **P1** 

### 4.4 Component Optimization

| Component | Concern | Priority |
|-----------|---------|----------|
| `ScraperPageClient` | 31 hooks — memoized URL hint, records-derived counts, preview rows | **P2** (partial) |
| `MyScentsPageClient` | 16 hooks — memoized `bottleEntries`, `bottleCountByPerfumeId` | **P2** (partial) |
| `TheExchangeClient` | Search / filter logic in client — consider extracting to a custom hook for clarity | **P2** |

---

## 5. Observability & Operations

### 5.1 Logging

- Currently: `console.log` / `console.error` scattered across 50+ files. In-memory audit logger lost on restart.
- **Recommendation**: Adopt a structured logger (e.g. **Pino**) with JSON output, request correlation IDs, and log levels. Non-breaking; can be done incrementally.
- **Partial:** `x-correlation-id` is set on every request in root `proxy.ts` (Next.js 16 — `middleware.ts` is not used alongside `proxy.ts`). `logAuditEvent` emits JSON lines including `correlationId`; `utils/server/structured-log.server.ts` provides `structuredLog` / `getRequestCorrelationId` for further adoption.
- **Priority:** **P1**

### 5.2 Monitoring

- `SecurityAuditLog` model exists for admin actions — good.
- No application-level metrics (response times, error rates, DB query durations).
- **Recommendation**: Add lightweight observability (e.g. Vercel Analytics, or a custom middleware that logs request duration).
- **Priority:** **P2**

### 5.3 PWA & Service Worker

- Service worker registration exists (`ServiceWorkerRegistration`).
- ~~Confirm the service worker doesn't cache API routes~~ **`public/sw.js`:** `/api/*` requests use `fetch` only (no cache). Navigate requests remain network-first with offline shell fallback.
- **Priority:** **P2**

---

## 6. Implementation Checklist

### P0 — Must-Fix Before Launch

- [x] Add auth (`requireAdminOrEditorApi`) to `/api/data-quality-houses`
- [x] Make `/api/cron/cleanup-messages` fail if `CRON_SECRET` is not set
- [x] Add rate limiting to `/api/auth/refresh`, sign-in, and sign-up endpoints
- [x] Fix `getUserByProfileSlug` to avoid loading all users into memory (add slug column + index, or use a `WHERE` with `LOWER()`)
- [x] Verify auth cookies set `Secure`, `HttpOnly`, `SameSite=Strict` in production
- [ ] Ensure `JWT_SECRET` is ≥ 32 characters in production environment

### P1 — Strongly Recommended

- [x] Add CSRF protection to `/api/ratings` POST
- [x] Add CSRF protection to admin scraper import/run routes
- [x] Add query param length limits on `/api/getTag`, `/api/perfume-houses`, `/api/perfume`
- [x] Validate record id format on `traderId`, `perfumeId`, etc. before DB queries (`isValidPrismaRecordId`)
- [x] Add rate limiting to `/api/change-password`, `/api/reviews` POST, `/api/ratings` POST
- [ ] Add security headers (HSTS, X-Frame-Options, etc.) — use root **`proxy.ts`** only (Next.js 16 disallows `middleware.ts` + `proxy.ts` together); correlation ID + CSRF already run there
- [x] Replace `new PrismaClient()` in scraper import with shared singleton from `lib/db.ts`
- [x] Add pagination / `take` limit to `getAllPerfumes` and `getAllPerfumesWithOptions`
- [x] Add `revalidateTag()` calls after perfume and house create/update/delete mutations (`utils/server/revalidate-catalog-cache.server.ts` + admin actions, delete routes, house image retry)
- [x] Wrap `getAllPerfumes`, `getAllPerfumesWithOptions`, `getAllHouses` in `unstable_cache` with tag-based invalidation
- [ ] Fetch first page of data server-side for The Vault and pass as `initialData`
- [ ] Add `loading.tsx` for admin, messages, profile, vault routes
- [ ] Add `error.tsx` for admin and messages routes
- [ ] Start replacing `any` types with proper Prisma / domain types (incremental)
- [ ] Adopt `withApiErrorHandling` / `safeAsync` in API routes for consistent error responses
- [ ] Adopt structured logging (Pino) — at least for API routes and critical paths
- [x] Ensure `react-icons` imports use sub-path imports (e.g. `react-icons/fi`) — verified: all app/components imports use `react-icons/<pack>`; no bare `react-icons` imports
- [x] Add `sitemap.ts` and `robots.ts` in the app directory

### P2 — Nice-to-Have / Iterative

- [ ] Parallelize R2 image uploads in scraper import with `Promise.all` + concurrency limit
- [ ] Batch note lookups in CSV import (single `findMany` instead of per-note queries)
- [ ] Add pagination to `getAvailablePerfumesForDecanting`
- [ ] Convert `app/not-found.tsx` to a server component
- [x] Split `Button` component into server-safe `Button` and client `VooDooLink` (`Button.tsx` + `VooDooLink.tsx`; barrel `index.ts`)
- [x] Rename misnamed server modules → `AboutUsContent.tsx`, `HowWeWorkContent.tsx`
- [ ] Extract shared slug generation to `utils/slug.ts`
- [ ] Extract shared Prisma select shapes to `lib/prisma-selects.ts`
- [ ] Extract tiered search pattern to a reusable helper
- [ ] Generalize R2 migration into a single entity-agnostic function
- [x] Memoize expensive computations in `ScraperPageClient` and `MyScentsPageClient`
- [x] Migrate `ChangePasswordForm` and contact pending submissions to server actions for progressive enhancement (`PendingSubmissionModal` + `app/contact-us/actions.ts`)
- [x] Add `generateMetadata` to all pages missing it (messages, thread, admin stats routes, `/behind-the-bottle`, home, auth, scraper; i18n keys under `directMessages.meta`)
- [ ] Add `Cache-Control` headers to public GET API routes
- [ ] Add request correlation IDs to structured logging
- [x] GSAP: dynamic `import("gsap")` in hero `useEffect` (removed unused `@gsap/react` preload); removed unused `TitleBannerAnimator`
- [x] Confirm service worker doesn't cache API routes (`public/sw.js` early return for `/api/`)
- [ ] Swap in-memory rate-limit store with Redis for multi-instance deployments
- [ ] Add application-level metrics/monitoring (Vercel Analytics or equivalent)

---

### Potentially Breaking Changes (flagged for awareness)

These items would improve the codebase but may require careful migration:

| Change | Risk | Mitigation |
|--------|------|------------|
| Add `slug` column to `User` table | Requires DB migration; existing profile URLs must still work | Add migration that backfills slugs from usernames; keep old lookup as fallback |
| Switch rate limiting to Redis | Requires new infrastructure dependency | Feature-flag or env toggle between in-memory and Redis |
| Convert forms from `fetch` to server actions | Changes request flow; may affect CSRF token handling | Migrate one form at a time; test thoroughly |
| Add request `proxy` / security headers (Next 16) | Could interfere with existing route behavior if misconfigured | Start with security headers only; avoid auth logic in `proxy.ts`; do not add `middleware.ts` while `proxy.ts` exists |
| Rename `*Client` server components | Any imports referencing the old names will break | Use find-and-replace across the repo; update all imports in one pass |

---

*This checklist should be revisited periodically as the application evolves. Items marked P0 should be addressed before any production launch.*
