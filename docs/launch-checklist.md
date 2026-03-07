# Launch Checklist

Full improvement report and implementation checklist for the Shadows Next.js codebase (performance, security, code reuse, Next.js best practices). Complete all checklist items before launch.

---

## Architecture Overview

**Stack:** Next.js 16.1.6 · React 19 · TypeScript · Prisma/PostgreSQL · TanStack Query v5 · TailwindCSS v4 · next-intl · Stripe · Cloudflare R2

**Router:** 100% App Router. Authentication is custom JWT (no NextAuth). No `middleware.ts` — all auth enforcement is per-layout / per-route.

**Directory structure (high level):**

- `app/` — App Router: pages, layouts, API routes, server actions; route groups `(auth)`, `[userSlug]/profile`, `admin`, `perfume/`, `houses/`, `the-vault/`, `the-exchange/`, `messages/`
- `components/` — UI (atoms / molecules / organisms / containers)
- `models/` — Database access layer (server-only, Prisma queries)
- `lib/` — `db.ts`, `auth/`, `queries/`, `mutations/`, `r2.ts`
- `utils/server/`, `utils/security/`, `utils/validation/` — Server utilities, session, rate limit, Zod schemas
- `hooks/` — Custom React hooks
- `prisma/` — Schema and migrations

---

## Security

### Critical

- **AI agent telemetry beacon in production** — `app/api/admin/scraper/run/route.ts` lines 185–198 contain a hardcoded `fetch("http://127.0.0.1:7886/ingest/...")` call injected by a Cursor AI agent and never removed. Every scraper invocation POSTs internal stderr data to localhost. Remove this block immediately.

- **Database backup files on disk** — Resolved: backup scripts now use a directory outside the repo root by default (`<repo-parent>/backups`), or `BACKUPS_DIR` if set. Move any existing `backups/` contents out of the repo and remove the folder if present.

### High

- **Session invalidation** — **Done.** `utils/security/session-manager.server.ts` implements a DB `tokenVersion` counter: tokens carry `tokenVersion` at issue time; `invalidateAllUserSessions(userId)` increments `User.tokenVersion` so existing JWTs fail verification. See `docs/token-security.md`. (Redis blocklist not required.)

- **JWT token-type confusion** — **Resolved.** System 1 (`lib/auth/tokens.ts`, `lib/auth/session.ts`) has been removed. All auth uses System 2 (`utils/security/session-manager.server.ts`), which checks `payload.type` and `tokenVersion`.

- **`/api/data-quality` is unauthenticated** — **Done.** `app/api/data-quality/route.ts` now uses `requireAdminOrEditorApi`; only admin or editor can access.

- **Cron endpoint open when `CRON_SECRET` is unset** — `app/api/cron/cleanup-messages/route.ts` only checks auth `if (cronSecret)` — if the env var is missing, the endpoint is fully open and can bulk-delete messages. Invert: fail-closed if secret is not configured.

### Medium

- **PII stored in alert metadata** — `models/user-alerts.server.ts` stores `email` fields from traders and interested users directly in the `UserAlert.metadata` JSONB column (lines 298–312, 437–441). Remove email; store only `userId` and resolve display info at read time.

- **In-memory rate limiter** — `utils/api-validation.server.ts` uses a process-local `Map`. On Vercel / any multi-instance deployment, each instance has its own counter and limits can be trivially bypassed. Replace with Upstash Redis or similar distributed store.

- **`/api/contact-trader` has no rate limiting** — **Resolved.** Route now calls `validateRateLimit` for per-user (per hour) and per-sender–recipient-pair (per day) using `getContactMessageRateLimits()`; returns 429 when exceeded. Tests in `app/api/contact-trader/route.test.ts`.

- **`AuthResult.user` typed as `any`** — **Resolved.** `AuthResult.user` is now `AuthUser` (Pick from Prisma `User`: id, email, firstName, lastName, username, role); tests in `utils/server/auth.server.test.ts`.

### Low

- **Redundant plaintext salt prefix in password hashes** — `utils/security/password-security.server.ts` prepends `randomBytes(16).toString("hex") + ":"` before the bcrypt hash. bcrypt already includes its own salt; this prefix is stored but not used in the bcrypt computation. Remove it.

- **`generateSecurePassword` uses `Math.random()`** — **Resolved.** Replaced with `crypto.getRandomValues()` for character selection and Fisher-Yates shuffle; tests in `utils/security/password-security.server.test.ts`.

- **`/api/ratings` POST missing CSRF check** — `app/api/ratings/route.ts` — every other mutation endpoint calls `requireCSRF`. Add it here for consistency.

- **No `middleware.ts`** — All protection is per-route. A single missed guard on a future route leaks data. Add a lightweight `middleware.ts` that at minimum validates the JWT cookie exists before routing to any `/api/` or protected page.

### What is done well (security)

- CSRF protection (double-submit cookie, timing-safe comparison) applied to most mutation routes
- No raw SQL; Prisma ORM used throughout
- Zod schemas used for input validation
- bcrypt with 12 salt rounds; password complexity enforced
- HTML sanitization for review content (`sanitize-html`, blocklist)
- Admin routes protected with `requireAdminSession`; API mutations use `requireAdminOrEditorApi`
- Cookies: `httpOnly`, `sameSite: "lax"`, `secure` in production
- Stripe webhook signature verification
- No hardcoded secrets; `.env*` and `/backups` in `.gitignore`

---

## Performance

### High

- **No server-side caching** — No use of `unstable_cache`, `export const revalidate`, or React `cache()`. Every page render hits the DB fresh. Targets:
  - `app/page.tsx` home stats (`prisma.user.count()`, etc.) — add `revalidate = 3600`
  - `app/the-exchange/page.tsx` — add `revalidate = 60`
  - Perfume and house detail pages — wrap model calls with `unstable_cache`
  - Use React `cache()` to deduplicate the double-fetch below

- **Hero image bypasses Next.js optimization** — `app/home-client.tsx` line 86 uses a plain `<img>` tag for the LCP element (a `.png` file). Replace with `<Image>` from `next/image` with `priority` prop and `sizes="100vw"`.

- **Double-fetch: `generateMetadata` + page render** — Three routes call the same DB query twice per request:
  - `app/perfume/[perfumeSlug]/page.tsx` — `getPerfumeBySlug` in both `generateMetadata` and page body
  - `app/houses/[houseSlug]/page.tsx` — `getPerfumeHouseBySlug` twice
  - `app/trader-profile/[id]/page.tsx` — `getTraderById` twice  
  Wrap each model function with React `cache()` to deduplicate within the same request.

### Medium

- **Static pages unnecessarily `use client`** — `app/about-us/AboutUsClient.tsx` and `app/how-we-work/HowWeWorkClient.tsx` are `use client` only for `useTranslations`. Convert to async server components using `getTranslations()` from `next-intl/server`.

- **GSAP static import** — `utils/rangeSliderUtils.ts` line 1: `import { gsap } from "gsap"` is top-level. Other GSAP usages use `await import("gsap")` in `useEffect`. Convert to dynamic import.

- **`ReactQueryDevtools` rendered unconditionally** — `app/providers.tsx` — wrap in `process.env.NODE_ENV === "development"` or use `next/dynamic` with an env check.

- **Redundant DB count query** — `models/house.server.ts` lines 326–330: `getPerfumeHouseBySlug` fetches `_count.perfumes` via `include` then runs a second `prisma.perfume.count()`. Use `house._count.perfumes` and remove the second query.

- **`WishlistPageClient` is `use client` only for `router.refresh()`** — `app/[userSlug]/profile/wishlist/WishlistPageClient.tsx` — replace `router.refresh()` with a Server Action that calls `revalidatePath`.

### Low

- **Vault and Houses pages return empty shells** — `app/the-vault/page.tsx` and `app/houses/page.tsx` pass no data to their client components; blank render until client fetch completes. Pass initial data as props (as `HouseDetailClient` and `PerfumeDetailClient` do).

- **No `<Suspense>` streaming** — No `<Suspense>` boundaries in `app/`. Add to perfume detail and exchange pages to stream secondary content.

- **`getAllPerfumes()` has no pagination guard** — `models/perfume.server.ts` — `findMany` with no `take`. Audit callers; add `take` or require pagination for large datasets.

---

## Code Reuse

- **`getCookieHeader` duplicated in 7+ page files** — Same helper in `app/trader-profile/[id]/page.tsx`, `app/[userSlug]/profile/page.tsx`, `app/[userSlug]/profile/my-scents/page.tsx`, `app/[userSlug]/profile/change-password/page.tsx`, `app/[userSlug]/profile/wishlist/page.tsx`, `app/houses/[houseSlug]/page.tsx`, `app/messages/[otherUserId]/page.tsx`, `app/layout.tsx`. Extract to `utils/server/get-cookie-header.server.ts`.

- **`sanitizeText` duplicated verbatim** — Same 16-line function in `models/perfume.server.ts` lines 382–399 and `models/house.server.ts` lines 619–636. Extract to `utils/server/sanitize.server.ts`.

- **`calculateRelevanceScore` near-duplicated** — Same algorithm in `models/perfume.server.ts` lines 261–306 and `models/house.server.ts` lines 452–497. Extract a generic `calculateRelevanceScore(name: string, term: string): number`.

- **`buildOrderBy` near-duplicated** — Same `switch` over sort options in both model files. Extract shared `buildNameOrderBy` factory to `utils/server/order-by.server.ts`.

- **Duplicate pagination pattern** — `app/the-vault/[letter]/TheVaultClient.tsx` and `app/houses/AllHousesClient.tsx` share ~50 lines (buildPath, navigate, useInfinitePagination, usePreserveScrollPosition, useSyncPaginationUrl). Extract `useAlphabeticalBrowserState` hook.

- **`TheExchangeClient` reimplements debounce** — `app/the-exchange/TheExchangeClient.tsx` uses manual `useRef` + `useEffect` for search debounce. Use existing `hooks/useDebouncedSearch.ts`.

- **`HousesListClient.tsx` is dead code** — `app/houses/HousesListClient.tsx` is not imported anywhere. Delete it.

- **Stale dual JWT system** — `lib/auth/tokens.ts` and `lib/auth/session.ts` (System 1) are superseded by `utils/security/session-manager.server.ts` (System 2). Delete System 1 to remove confusion and the token-type vulnerability.

---

## Next.js Best Practices

- **`isRedirectError` manual detection** — `app/(auth)/sign-in/actions.ts` detects redirect errors by matching the string `"NEXT_REDIRECT"` against `error.digest`. Use `isRedirectError` from `next/navigation` instead.

- **Missing root `.env.example`** — **Done.** Root `.env.example` documents DATABASE_URL, JWT_SECRET, Stripe, R2, cron, session overrides, rate limits, scraper/OpenAI, and script-only vars (LOCAL/REMOTE_DATABASE_URL, BACKUPS_DIR).

- **`TitleBanner.tsx` forces large client boundary** — Used on many pages; entire banner is `use client` due to GSAP `useEffect`. Extract animation to a `TitleBannerAnimator` client child so the banner can be a server component.

- **`GlobalNavigation.tsx` `isClientReady` hydration guard** — `requestIdleCallback` workaround with hardcoded fallback strings suggests i18n SSR may not be fully wired for nav. Investigate next-intl server-side translation for the nav component.

- **`PerfumeDetailClient.tsx` `as never` type casts** — Lines 157–160 cast props due to mismatch between `PerfumeDetailClient` and `PerfumeRatingSystem`. Define shared types and remove casts.

---

## Implementation Checklist

### Security — Do First

- [x] **[CRITICAL]** Remove AI agent telemetry beacon from `app/api/admin/scraper/run/route.ts` lines 185–198
- [x] **[CRITICAL]** Move `backups/` directory outside the repository root
- [x] **[HIGH]** Fix session invalidation — implement `tokenVersion` counter in DB or Redis blocklist in `utils/security/session-manager.server.ts` (done: DB tokenVersion in session-manager; see `docs/token-security.md`)
- [x] **[HIGH]** Delete `lib/auth/tokens.ts` and `lib/auth/session.ts` (System 1 JWT); migrate all callers to System 2 (done: no callers used System 1; files removed)
- [x] **[HIGH]** Add auth check to `app/api/data-quality/route.ts` (requireAdminOrEditorApi)
- [ ] **[HIGH]** Invert cron secret check to fail-closed in `app/api/cron/cleanup-messages/route.ts`
- [ ] **[MED]** Remove `email` fields from `UserAlert.metadata` in `models/user-alerts.server.ts`
- [ ] **[MED]** Replace in-memory rate limiter with Upstash Redis (or similar) in `utils/api-validation.server.ts`
- [x] **[MED]** Add `validateRateLimit` calls to `app/api/contact-trader/route.ts`
- [x] **[MED]** Type `AuthResult.user` with the Prisma `User` type in `utils/server/auth.server.ts`
- [x] **[LOW]** Remove redundant plaintext salt prefix from `hashPassword` in `utils/security/password-security.server.ts`
- [x] **[LOW]** Replace `Math.random()` with `crypto.getRandomValues()` in `generateSecurePassword`
- [ ] **[LOW]** Add `requireCSRF` to `app/api/ratings/route.ts` POST handler
- [ ] **[LOW]** Add `middleware.ts` with baseline JWT presence check for protected routes
- [x] **[LOW]** Create root `.env.example` documenting all required environment variables

### Performance

- [x] **[HIGH]** Wrap `getPerfumeBySlug`, `getPerfumeHouseBySlug`, `getTraderById` with React `cache()` to eliminate double-fetch in `generateMetadata`
- [x] **[HIGH]** Replace `<img>` with `<Image priority sizes="100vw">` in `app/home-client.tsx` line 86
- [x] **[HIGH]** Add `export const revalidate` to `app/page.tsx` (home stats) and `app/the-exchange/page.tsx`
- [x] **[HIGH]** Add `unstable_cache` wrapping to perfume and house detail model queries
- [x] **[MED]** Convert `app/about-us/AboutUsClient.tsx` to async server component using `getTranslations()`
- [x] **[MED]** Convert `app/how-we-work/HowWeWorkClient.tsx` to async server component using `getTranslations()`
- [x] **[MED]** Convert GSAP import in `utils/rangeSliderUtils.ts` from static to dynamic
- [x] **[MED]** Guard `<ReactQueryDevtools>` in `app/providers.tsx` behind `process.env.NODE_ENV === "development"`
- [x] **[MED]** Fix redundant `prisma.perfume.count()` in `models/house.server.ts` — use `house._count.perfumes`
- [x] **[MED]** Replace `router.refresh()` in `WishlistPageClient.tsx` with a Server Action + `revalidatePath`
- [x] **[LOW]** Pass initial data from server to `TheVaultClient` and `AllHousesClient`
- [x] **[LOW]** Add `<Suspense>` boundaries to at least `app/perfume/[perfumeSlug]/page.tsx` and `app/the-exchange/page.tsx`
- [x] **[LOW]** Add `take` limit / pagination guard to `getAllPerfumes()` in `models/perfume.server.ts`

### Code Reuse

- [x] Extract `getCookieHeader` to `utils/server/get-cookie-header.server.ts` and remove 7+ duplicates
- [x] Extract `sanitizeText` from `models/perfume.server.ts` and `models/house.server.ts` to a shared util
- [x] Extract `calculateRelevanceScore` to a shared util used by both model files
- [x] Extract `buildNameOrderBy` factory to `utils/server/order-by.server.ts`
- [x] Create `useAlphabeticalBrowserState` hook to replace duplicated pagination setup in `TheVaultClient` and `AllHousesClient`
- [x] Replace manual debounce in `TheExchangeClient.tsx` with existing `hooks/useDebouncedSearch.ts`
- [x] Delete `app/houses/HousesListClient.tsx` (dead code, no imports)

### Next.js Best Practices

- [ ] Replace manual `"NEXT_REDIRECT"` string check in `app/(auth)/sign-in/actions.ts` with `isRedirectError` from `next/navigation` (blocked: not exported in Next 16.x)
- [x] Extract GSAP animation from `TitleBanner.tsx` to a `TitleBannerAnimator` client child to reduce the client boundary surface area
- [x] Investigate and fix `GlobalNavigation.tsx` `isClientReady` hydration workaround
- [x] Define shared prop types for `PerfumeDetailClient` / `PerfumeRatingSystem` to replace `as never` casts
