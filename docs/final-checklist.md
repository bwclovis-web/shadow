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
| `/api/cron/cleanup-messages` runs without auth if `CRON_SECRET` is unset | `app/api/cron/cleanup-messages/route.ts` | **P0** |
| Admin scraper routes (`/api/admin/scraper/import`, `/run`) lack CSRF protection | `app/api/admin/scraper/*/route.ts` | **P1** |
| `/api/ratings` POST is missing CSRF protection | `app/api/ratings/route.ts` | **P1** |

**Fixes (non-breaking):**

- Add `requireAdminOrEditorApi` to `/api/data-quality-houses`.
- Make `/api/cron/cleanup-messages` fail early when `CRON_SECRET` is not set.
- Add CSRF validation (`validateCsrfToken`) to the admin scraper routes and `/api/ratings` POST.

### 1.2 Input Validation

| Issue | Priority |
|-------|----------|
| No query-string length limits on `/api/getTag`, `/api/perfume-houses`, `/api/perfume` (DoS vector) | **P1** |
| `traderId` in `/api/trader-feedback` GET is not UUID-validated | **P1** |
| `perfumeId` in `/api/ratings` POST is not UUID-validated | **P2** |
| `sortBy` in `/api/perfumeSortLoader` is cast without validation | **P2** |

**Fixes (non-breaking):**

- Clamp query params to a max length (e.g. 200 chars) at the start of each handler.
- Validate IDs against a UUID regex before passing to Prisma.

### 1.3 Rate Limiting

Only `/api/contact-trader` is rate-limited today. The in-memory `Map` approach also doesn't work across multiple instances.

| What to rate-limit | Priority |
|--------------------|----------|
| `/api/auth/refresh`, sign-in, sign-up | **P0** |
| `/api/change-password` | **P1** |
| `/api/reviews` POST, `/api/ratings` POST | **P1** |
| `/api/wishlist` POST | **P2** |

**Fixes (non-breaking):**

- Apply `validateRateLimit` to the routes above using sensible windows (e.g. 5 req / min for auth).
- For production multi-instance deployments, swap the in-memory store with a Redis-backed store (e.g. `@upstash/ratelimit`) — this is a **breaking change** if there's no Redis yet; flag it for post-launch.

### 1.4 Middleware

There is **no root `middleware.ts`**. Adding one is optional but recommended.

**Fixes (non-breaking):**

- Add `middleware.ts` to set security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`) on every response. `helmet` is already a dependency but unused in Next.js context.
- Optionally add global auth gating for `/admin/*` routes in middleware for defense-in-depth.

### 1.5 Cookie & Token Hardening

- Verify `Secure`, `HttpOnly`, `SameSite=Strict` flags are set on **all** auth cookies in production.
- Confirm `JWT_SECRET` is at least 32 characters (`.env.example` documents this).

---

## 2. Performance

### 2.1 Database & Query Optimization

| Issue | Location | Priority |
|-------|----------|----------|
| `getUserByProfileSlug` loads **all users** into memory to find a slug match | `models/user.query.ts` | **P0** |
| `getAllPerfumes` has a hard cap of 5000 rows with no cursor pagination | `models/perfume.server.ts` | **P1** |
| `getAllPerfumesWithOptions` has no `take` limit — unbounded result set | `models/perfume.server.ts` | **P1** |
| `getAvailablePerfumesForDecanting` has no pagination | `models/perfume.server.ts` | **P2** |
| Scraper import uploads images to R2 sequentially in a `for` loop | `app/api/admin/scraper/import/route.ts` | **P1** |
| Note resolution in CSV import calls `getOrCreateNote` + `upsertNoteRelation` per note sequentially | `lib/import-perfume-csv.ts` | **P2** |
| Scraper import creates its own `PrismaClient` instead of reusing the singleton | `app/api/admin/scraper/import/route.ts` | **P1** |

**Fixes (non-breaking):**

- **`getUserByProfileSlug`**: Add a `slug` column to the `User` table (or a computed/stored slug) with a unique index. Query directly instead of loading all users. *This requires a migration — plan carefully.*
- **`getAllPerfumes` / `getAllPerfumesWithOptions`**: Add cursor-based pagination; keep the current API as a backwards-compatible default with a reasonable `take` limit.
- **Scraper R2 uploads**: Use `Promise.all` with a concurrency limiter (e.g. `p-limit(5)`).
- **Note resolution**: Batch `findMany({ where: { name: { in: [...] } } })` first, then only create missing notes.
- **Prisma singleton**: Replace `new PrismaClient()` in the import route with the shared `prisma` from `lib/db.ts`.

### 2.2 Caching

| What | Current State | Recommendation | Priority |
|------|---------------|----------------|----------|
| Perfume/house by slug | `unstable_cache` with 3600s TTL | Good — keep | — |
| `getAllPerfumes`, `getAllHouses` | No caching | Wrap in `unstable_cache` with tags | **P1** |
| Tag invalidation on mutations | Missing | Call `revalidateTag("perfume")` / `revalidateTag("house")` after create/update/delete | **P1** |
| The Vault initial data | Fetched entirely on client | Server-render the first page of perfumes and pass as `initialData` | **P1** |
| API GET routes | No `Cache-Control` headers | Add `s-maxage` / `stale-while-revalidate` headers for public data endpoints | **P2** |

### 2.3 Client Bundle

| Issue | Priority |
|-------|----------|
| `react-icons` — importing from barrel files pulls large chunks; prefer importing from sub-paths (e.g. `react-icons/fi`) | **P1** |
| `chart.js` is dynamically imported in `DataQualityClient` — good, no action needed | — |
| GSAP loaded for `TitleBannerAnimator` — consider dynamic import if only used on one page | **P2** |
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
| `components/Atoms/Button/Button.tsx` | Entire file is `"use client"` because `VooDooLink` uses `useTransitionRouter` | Split `Button` (server) from `VooDooLink` (client) | **P2** |
| `AboutUsClient.tsx`, `HowWeWorkClient.tsx` | Named `*Client` but are actually server components | Rename to drop the "Client" suffix for clarity | **P2** |
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

- Migrating `ChangePasswordForm` and `ContactUsClient` to server actions + Conform for consistency and progressive enhancement (**P2**).
- Ensuring all `fetch`-based mutations include CSRF tokens (most do already).

### 3.4 Metadata & SEO

- Confirm each page exports a `generateMetadata` function or static `metadata` object for titles, descriptions, and Open Graph tags.
- Add `robots.txt` and `sitemap.xml` generation (Next.js supports `app/sitemap.ts` and `app/robots.ts`).

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
| `ScraperPageClient` | 31 hooks — check for unnecessary re-renders; memoize expensive computations | **P2** |
| `MyScentsPageClient` | 16 hooks — similar | **P2** |
| `TheExchangeClient` | Search / filter logic in client — consider extracting to a custom hook for clarity | **P2** |

---

## 5. Observability & Operations

### 5.1 Logging

- Currently: `console.log` / `console.error` scattered across 50+ files. In-memory audit logger lost on restart.
- **Recommendation**: Adopt a structured logger (e.g. **Pino**) with JSON output, request correlation IDs, and log levels. Non-breaking; can be done incrementally.
- **Priority:** **P1**

### 5.2 Monitoring

- `SecurityAuditLog` model exists for admin actions — good.
- No application-level metrics (response times, error rates, DB query durations).
- **Recommendation**: Add lightweight observability (e.g. Vercel Analytics, or a custom middleware that logs request duration).
- **Priority:** **P2**

### 5.3 PWA & Service Worker

- Service worker registration exists (`ServiceWorkerRegistration`).
- Confirm the service worker is correctly scoped and doesn't cache API routes.
- **Priority:** **P2**

---

## 6. Implementation Checklist

### P0 — Must-Fix Before Launch

- [x] Add auth (`requireAdminOrEditorApi`) to `/api/data-quality-houses`
- [ ] Make `/api/cron/cleanup-messages` fail if `CRON_SECRET` is not set
- [ ] Add rate limiting to `/api/auth/refresh`, sign-in, and sign-up endpoints
- [ ] Fix `getUserByProfileSlug` to avoid loading all users into memory (add slug column + index, or use a `WHERE` with `LOWER()`)
- [ ] Verify auth cookies set `Secure`, `HttpOnly`, `SameSite=Strict` in production
- [ ] Ensure `JWT_SECRET` is ≥ 32 characters in production environment

### P1 — Strongly Recommended

- [ ] Add CSRF protection to `/api/ratings` POST
- [ ] Add CSRF protection to admin scraper import/run routes
- [ ] Add query param length limits on `/api/getTag`, `/api/perfume-houses`, `/api/perfume`
- [ ] Validate UUID format on `traderId`, `perfumeId`, etc. before DB queries
- [ ] Add rate limiting to `/api/change-password`, `/api/reviews` POST, `/api/ratings` POST
- [ ] Add root `middleware.ts` with security headers (HSTS, X-Frame-Options, etc.)
- [ ] Replace `new PrismaClient()` in scraper import with shared singleton from `lib/db.ts`
- [ ] Add pagination / `take` limit to `getAllPerfumes` and `getAllPerfumesWithOptions`
- [ ] Add `revalidateTag()` calls after perfume and house create/update/delete mutations
- [ ] Wrap `getAllPerfumes`, `getAllHouses` in `unstable_cache` with tag-based invalidation
- [ ] Fetch first page of data server-side for The Vault and pass as `initialData`
- [ ] Add `loading.tsx` for admin, messages, profile, vault routes
- [ ] Add `error.tsx` for admin and messages routes
- [ ] Start replacing `any` types with proper Prisma / domain types (incremental)
- [ ] Adopt `withApiErrorHandling` / `safeAsync` in API routes for consistent error responses
- [ ] Adopt structured logging (Pino) — at least for API routes and critical paths
- [ ] Ensure `react-icons` imports use sub-path imports (e.g. `react-icons/fi`)
- [ ] Add `sitemap.ts` and `robots.ts` in the app directory

### P2 — Nice-to-Have / Iterative

- [ ] Parallelize R2 image uploads in scraper import with `Promise.all` + concurrency limit
- [ ] Batch note lookups in CSV import (single `findMany` instead of per-note queries)
- [ ] Add pagination to `getAvailablePerfumesForDecanting`
- [ ] Convert `app/not-found.tsx` to a server component
- [ ] Split `Button` component into server-safe `Button` and client `VooDooLink`
- [ ] Rename `AboutUsClient` and `HowWeWorkClient` (they are actually server components)
- [ ] Extract shared slug generation to `utils/slug.ts`
- [ ] Extract shared Prisma select shapes to `lib/prisma-selects.ts`
- [ ] Extract tiered search pattern to a reusable helper
- [ ] Generalize R2 migration into a single entity-agnostic function
- [ ] Memoize expensive computations in `ScraperPageClient` and `MyScentsPageClient`
- [ ] Migrate `ChangePasswordForm` and `ContactUsClient` to server actions for progressive enhancement
- [ ] Add `generateMetadata` to all pages missing it
- [ ] Add `Cache-Control` headers to public GET API routes
- [ ] Add request correlation IDs to structured logging
- [ ] Dynamically import GSAP if only used on one page
- [ ] Confirm service worker doesn't cache API routes
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
| Add root `middleware.ts` | Could interfere with existing route behavior if misconfigured | Start with security headers only; avoid auth logic initially |
| Rename `*Client` server components | Any imports referencing the old names will break | Use find-and-replace across the repo; update all imports in one pass |

---

*This checklist should be revisited periodically as the application evolves. Items marked P0 should be addressed before any production launch.*
