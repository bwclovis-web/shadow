# Next.js Improvements

Technical review and phased cleanup plan for **perfumer's hollow** (Next.js 16 App Router, React 19, Prisma, TanStack Query). Use this document to prioritize refactors that improve **security**, **performance**, **maintainability**, and **developer experience** without changing product behavior.

**Last updated:** May 2026  
**Status:** Planning — work tracked by phase below

---

## Related documentation

| Doc | Focus |
|-----|--------|
| [FUTURE_IDEAS.md](./FUTURE_IDEAS.md) | Product roadmap and monetization |
| [CUSTOMER_FEATURES_BACKLOG.md](./CUSTOMER_FEATURES_BACKLOG.md) | Customer-facing features |
| [QOL_AND_OPERATIONS_PLAN.md](./QOL_AND_OPERATIONS_PLAN.md) | Internal ops and QOL |
| [database-migrations.md](./database-migrations.md) | Schema workflow (`db push` vs migrate) |
| [trader-reputation.md](./trader-reputation.md) | Reputation domain |
| [live-testing.md](./live-testing.md) | Manual QA |
| [scraper-troubleshooting.md](./scraper-troubleshooting.md) | Admin scraper ops |

This file is **engineering cleanup**. Product ideas belong in the docs above.

---

## Executive summary

The application is mature (~415 components, ~80 API routes, ~129 test files) with strong patterns already in place:

- Server `page.tsx` → client `*Client.tsx` boundaries
- TanStack Query with hierarchical query keys in `lib/queries/`
- CSRF double-submit via `proxy.ts` and server actions
- Parameterized Prisma queries (safe raw SQL where used)
- Co-located Vitest tests on critical paths

Main technical debt clusters:

1. **Security** — PII in public APIs, IDOR on comments, inconsistent CSRF coverage
2. **Duplication** — Profile auth blocks, fetch/upload helpers, polling providers, trader modals
3. **Performance** — Wide root client tree, duplicate compare-page fetch, missing list memoization
4. **Architecture** — Overlapping `models/`, `lib/`, and `utils/` responsibilities; very large modules

Recommended order: **security first**, then **shared utilities**, **deduplication**, **performance**, **architecture splits**, **tooling/docs**.

---

## Current strengths (preserve these)

| Area | Pattern | Location |
|------|---------|----------|
| Data fetching (server) | Parallel `Promise.all` on heavy pages | `app/perfume/[perfumeSlug]/page.tsx`, `app/the-exchange/page.tsx`, `app/page.tsx` |
| Data fetching (client) | Query key factories + invalidation | `lib/queries/` |
| Forms | Conform + Zod + Server Actions | Auth, admin, profile routes |
| Auth cookies | `httpOnly`, `secure`, `sameSite` in production | `utils/security/auth-cookie.server.ts` |
| Reviews XSS | Sanitize on write + render | `utils/sanitize.ts`, `ReviewCard.tsx` |
| Webhooks | Stripe + Sanity signature/secret checks | `app/api/stripe-webhook/`, `app/api/sanity/revalidate/` |
| Request tracing | Correlation ID on every request | `proxy.ts` |
| i18n | `next-intl` + `messages/{en,es,fr,it}.json` | `i18n/request.ts` |
| Images | `next/image` + `remotePatterns` | `next.config.ts` |
| Home performance | Dynamic import of heavy sections | `app/home-client.tsx` |

---

## Phase 0 — Security hardening (do first)

Isolated, high-impact fixes. Add regression tests with each change.

### 0.1 Remove PII from public API responses

| Issue | Files | Fix |
|-------|-------|-----|
| Trader email exposed on public GET | `app/api/trader/[id]/route.ts`, `models/user.server.ts` (`getTraderById`) | Add `getPublicTraderById` (or narrow select) — omit `email` |
| Reviewer email in review payloads | `models/perfumeReview.server.ts`, `app/api/reviews/route.ts` | Strip `user.email` from public responses |

### 0.2 Fix authorization bugs (IDOR)

| Issue | Files | Fix |
|-------|-------|-----|
| Private listing comments readable by any authenticated user | `app/api/user-perfumes/route.ts` (`get-comments`), `models/user.server.ts` | Verify `userPerfumeId` belongs to caller; non-owners see only `isPublic` comments |
| Comments attached to wrong listing row | Same route (`add-comment`) | Validate `userPerfumeId` matches authenticated user before create |
| Unapproved reviews leak | `app/api/reviews/route.ts` | Default `isApproved: true` for anonymous/public callers; admin-only moderation view |

### 0.3 Close CSRF and auth gaps

- Add `requireCSRF` to `app/api/activity/ping/route.ts`
- Cron routes: remove `?secret=` query auth — Bearer header only (`app/api/cron/data-quality-snapshot/route.ts`, `app/api/cron/cleanup-messages/route.ts`)
- Align **admin vs editor**: `app/admin/layout.tsx` (admin only) vs `utils/server/requireAdminOrEditorApi.server.ts` (admin + editor on API) — pick one policy and enforce in layout + API + server actions

### 0.4 Upload and input hardening

- Magic-byte validation on image uploads (`app/api/listing-images/`, `avatar-images/`, `report-images/`) — do not trust `file.type` alone
- Sanitize comment text on write in `models/user.server.ts` (`addPerfumeComment`) via `utils/sanitize.ts`
- Remove or sanitize `htmlLabel` in `components/Atoms/CheckBox/CheckBox.tsx` (`dangerouslySetInnerHTML` — latent XSS if misused)

### 0.5 Rate limiting and abuse surface

- In-memory rate limit in `utils/api-validation.server.ts` is per-instance on serverless — plan **Redis/Upstash** for sign-in, contact-trader, and bulk export endpoints
- `GET` on `app/api/user-perfumes/route.ts` returns full catalog to any logged-in user — paginate, rate-limit, or restrict to admin/editor if not intentional

### 0.6 Security follow-ups (medium priority)

- **Content-Security-Policy** — not defined in `next.config.ts`; add strict CSP (especially because CSRF cookie is JS-readable)
- **Full API auth matrix** — audit all ~80 routes for consistent `authenticateUser` / role checks (separate pass from this doc)
- **Environment validation** — validate required env vars at startup with Zod (e.g. `JWT_SECRET`, `DATABASE_URL`) to fail fast in deploy
- **Session fixation / rotation** — confirm refresh-token rotation on privilege change (2FA completion, password change)

---

## Phase 1 — Shared server and client utilities

### 1.1 Profile page auth helper

Eight profile routes repeat:

```typescript
const session = await getSessionFromCookieHeader(cookieHeader, { includeUser: true })
if (!session?.user) redirect("/sign-in")
const slug = getProfileSlug(session.user)
if (slug !== userSlug) redirect(`/${slug}/profile`)
```

**Create** `utils/server/require-profile-session.server.ts`:

- `requireOwnedProfileSession(userSlug)` → `{ user, session }`
- Replace in all profile `page.tsx` files under `app/[userSlug]/profile/`
- Unit test mirroring `utils/server/auth.server.test.ts`

### 1.2 Centralize client fetch utilities

**Create** `lib/api-client.ts`:

```typescript
export const apiFetch = async <T>(url: string, init?: RequestInit): Promise<T> => { /* ... */ }
export const getCsrfHeaders = (): HeadersInit => { /* ... */ }
export const postFormWithCsrf = (url: string, formData: FormData) => { /* ... */ }
```

- Export `getCSRFFromCookie` from `hooks/useCSRF.ts`; remove duplicates in `lib/mutations/follow.ts`, `wishlist.ts`, `perfumes.ts`, `houses.ts`
- Unify `utils/listing-images-client.ts`, `report-images-client.ts`, `avatar-images-client.ts` → `uploadImage(endpoint, file, csrfHeaders)` + thin wrappers

### 1.3 Generic query fetch factory

`lib/queries/houses.ts` and `lib/queries/perfumes.ts` share letter-pagination fetch logic. Extract `createLetterPaginatedQuery(config)` without changing query keys.

### 1.4 Consolidate duplicate utilities

| Duplicate | Action |
|-----------|--------|
| `utils/formValidationSchemas.ts` vs `utils/validation/formValidationSchemas.ts` | Move `ContactTraderSchema` into validation folder; fix import in `ContactTraderForm.tsx` (`~/utils/formValidationSchemas` today) |
| `utils/server/audit-logger.server.ts` vs `utils/security/audit-logger.server.ts` | Merge into one module under `utils/security/` |

### 1.5 Contact-trader request helper

`ContactTraderButton.tsx` and `app/exchanges/[otherUserId]/ThreadClient.tsx` both POST to `/api/contact-trader` with different header helpers — use shared `postFormWithCsrf` / `prepareApiRequest` pattern.

---

## Phase 2 — Component and UI deduplication

### 2.1 Unread polling consolidation

Three 30s pollers overlap:

- `hooks/useUserAlerts.ts`
- `components/Molecules/TradeAlertUnread/TradeAlertUnreadProvider.tsx`
- `components/Molecules/DirectMessageUnread/DirectMessageUnreadProvider.tsx`

**Create** single `UnreadCountsProvider` (or extend `UserAlertsProvider`):

- SSR initial counts from `app/layout.tsx` (already loaded server-side)
- One poll interval; pause when `document.visibilityState === 'hidden'`
- Expose hooks for DM, trade, and general alerts

### 2.2 Trader profile modal button primitive

Shared pattern in `ContactTraderButton`, `ReportTraderButton`, `ProposeTradeButton`, `OpenDisputeButton`, `AddToCollectionModal`:

- `viewerId === traderId` guard
- `getTraderDisplayName` + modal toggle + trigger ref

**Create** `TraderActionButton` with `label` + modal `children`.

### 2.3 Photo lightbox extraction

`ListingPhotos.tsx` and `ExchangeMultiListingPhotos.tsx` — extract `usePhotoLightbox` + `PhotoLightbox` molecule.

### 2.4 House search typeahead merge

`HouseTypeahead.tsx` and `HouseAutocomplete.tsx` both hit `/api/perfume-houses?name=...` — one component with `variant` prop.

### 2.5 Profile list page layout

`MyReportsPageClient.tsx` and `MyDisputesPageClient.tsx` — extract `ProfileListPageLayout` (banner, back link, action alert, empty state, card list).

### 2.6 Inline fetch → `lib/queries`

| Component | Replace inline fetch with |
|-----------|---------------------------|
| `components/Organisms/ReviewSection/ReviewSection.tsx` | `lib/queries/reviews.ts` + React Query |
| `components/Containers/Perfume/PerfumeRatingSystem/PerfumeRatingSystem.tsx` | `lib/queries/reviews.ts` (`getRatings`) |

### 2.7 Form stack decision

- **Standard:** Conform + Zod + Server Actions (auth, admin, profile)
- **Legacy:** `useFormState` / `useValidation` (e.g. `DeStashForm`)

Migrate legacy forms incrementally; do not block security/perf work on full migration.

### 2.8 Add missing `'use client'` directives

~14 hook-using components lack explicit directive (fragile if imported from server by mistake):

- `ReviewSection.tsx`, `TagSearch.tsx`, `PerfumeRatingSystem.tsx`, `DestashManager.tsx`, `RichTextEditor.tsx`, `NoirRating.tsx`, `ContactTraderForm.tsx`, `DataDisplaySection.tsx`, `RecommendedForYou.tsx`, and others found in audit

### 2.9 Admin create/edit client shells

`CreateHouseClient` / `EditHouseClient`, `CreatePerfumeClient` / `EditPerfumeClient` — shared `AdminFormPageShell` (TitleBanner + PageWrapper + `useActionState`).

### 2.10 Auth form shell

`SignInClient.tsx` (at `app/(auth)/SignInClient.tsx`) vs `sign-up/SignUpClient.tsx` — shared `AuthFormLayout` for consistent placement and `CSRFToken`.

---

## Phase 3 — Performance optimization

### 3.1 Fix duplicate compare page fetch (quick win)

`app/compare/ComparePageClient.tsx`:

- `useEffect` calls `fetchComparePerfumes(urlIds)` (~line 240)
- `useComparePayload(orderedIds)` fetches again (~line 282)

**Fix:** Server-pass `initialData` from `app/compare/page.tsx`; single React Query source; keep URL sync only.

### 3.2 Shrink root client boundary

`app/layout.tsx` loads for every route:

- Global nav (desktop + mobile + bottom)
- Four unread/badge providers + `UserAlertsProvider`
- `Providers` (React Query + global `CompareTray`)
- `ActivityPing`, service worker, onboarding slot

**Actions:**

- Route group `app/(authenticated)/layout.tsx` for alert providers + `ActivityPing`
- `dynamic(() => import('CompareTray'), { ssr: false })` when compare store has items
- Lazy-load `MyScentsModal` (~616 lines), `DiscoveryFiltersPanel`, trade modals on exchange (pattern: `home-client.tsx`)
- Lazy-load `RichTextEditor` only when review compose opens
- Lazy-load `TagSearch` on scent-quiz note steps

### 3.3 List row memoization

Extract row components and wrap in `React.memo` (stable callbacks only where needed):

| Row component | Parent list |
|---------------|-------------|
| `ListingCard` | `MyListingsPanel.tsx` |
| `ExchangePerfumeCard` | `TheExchangeClient.tsx` |
| `ExchangeListingRow` | Exchange views |
| `WishlistItemCard` | Wishlist pages |
| `BulkInventoryRow` | `BulkInventoryGrid.tsx` |
| Collection grid item | `MyScentsPageClient.tsx` |
| `ReviewCard` rows | `ReviewSection.tsx` |

Avoid blanket `useCallback` on cheap handlers (project rule: optimize when measured).

### 3.4 Eliminate props → state sync in `useEffect`

| File | Pattern | Fix |
|------|---------|-----|
| `MyScentsPageClient.tsx` | Sync props to `userPerfumes` / `stats` | `key={userId}` reset or derive from props |
| `ReviewSection.tsx` | Sync `initialReviewsData` | Initialize once; local updates after mutations |
| `PerfumeRatingSystem.tsx` | Sync `initialAverageRatings` | Use prop directly or `key={perfumeId}` |

### 3.5 Defer tab-hidden fetches

`DecantSplitsPanel.tsx` fetches `/api/decant-splits/mine` on mount even when tab hidden — fetch on tab activate or SSR from `my-scents/page.tsx`.

### 3.6 Token refresh scope

`hooks/useTokenRefresh.ts` — `router.refresh()` 1s after mount retriggers full RSC tree. Refresh on 401 or tab visible after idle only.

### 3.7 Image and font optimization

- Add `sizes` on `CompareTray` thumbnails
- Reduce nav logo `quality={90}` → `75` in `GlobalNavigation.tsx`
- Audit `TitleBanner` `unoptimized` usage for production CDN strategy

### 3.8 Server fetch sequencing

Minor waterfalls after `Promise.all`:

- `app/the-exchange/page.tsx` — `loadTraderReputationsForUserIds` after main payload (parallelize if cheap)
- `app/[userSlug]/profile/my-scents/page.tsx` — reputation after wishlist demand

### 3.9 Archive first paint

`app/the-archive/page.tsx` passes empty `initialPerfumes` — consider SSR first letter or redirect to `/the-archive/[letter]` for faster LCP.

### 3.10 GSAP bundle cost

`useRangeSlider.ts` statically imports `@gsap/react`; align with dynamic GSAP import pattern used in `NoirIcon.tsx` and `rangeSliderUtils.ts`.

### 3.11 Measure before/after

- `@next/bundle-analyzer` on `CompareTray`, root layout, and `MyScentsPageClient` splits
- Lighthouse on `/`, `/the-exchange`, `/compare`, profile my-scents (see historical perf docs if re-added)

---

## Phase 4 — Architecture and maintainability

### 4.1 Document server layer boundaries

Add `docs/server-layers.md`:

| Layer | Responsibility | Example |
|-------|----------------|---------|
| `models/*.server.ts` | Prisma + domain rules | `trade.server.ts` |
| `services/` | Pure computation, no I/O | `services/recommendations/` |
| `lib/queries/` + `lib/mutations/` | Client cache + fetchers | `lib/queries/houses.ts` |
| `utils/**/*.server.ts` | Cross-cutting infra | CSRF, email, session |

Rule: API routes call `models/` or `services/` for business logic; avoid business rules buried only in `utils/`.

### 4.2 Split oversized modules (one PR per file)

| File | ~Lines | Split strategy |
|------|--------|----------------|
| `lib/scraper/notes-graph.ts` | 4000+ | `lib/scraper/stages/*` + thin orchestrator |
| `models/user.server.ts` | 900+ | profile / inventory / comments modules |
| `models/perfume.server.ts` | 900+ | search / detail / admin |
| `MyScentsPageClient.tsx` | 675 | `CollectionTab`, `ListingsTab`, `StatsHeader` |

### 4.3 Routing and URL model

- Owner dashboard: `app/[userSlug]/profile/*`
- Public trader: `app/trader-profile/[id]/*`

Document when to link to which; consider canonical URLs for SEO (trader public vs slug).

### 4.4 Path aliases

Both `@/` and `~/` map to repo root — standardize on `@/` in new code.

### 4.5 Move docs out of component tree

Relocate `components/Containers/DataQualityDashboard/*.md` (e.g. `REFACTORING_SUMMARY.md`) into `docs/`.

### 4.6 Scripts cleanup

Follow `scripts/OBSOLETE_SCRIPTS_ANALYSIS.md` — archive dead scripts; run `npx knip` on app code after refactors (`knip.json` ignores `scripts/**`).

### 4.7 Dependencies hygiene

- `styled-components` in `package.json` — confirm Sanity-only or remove if unused
- `csv-parse` ignored by knip — verify still needed vs `papaparse`

---

## Phase 5 — Tooling, tests, and documentation

### 5.1 Update stale documentation

- `lib/queries/README.md` — remove React Router / wrong paths; document Next.js + RSC hydration
- `components/Molecules/CSRFToken/README.md` — CSRF cookie is **not** httpOnly by design; document XSS + CSP dependency

### 5.2 Test coverage gaps

| Area | Current | Target |
|------|---------|--------|
| Unit/integration | Vitest, ~129 files | Keep co-located tests for new utilities |
| E2E | No Playwright/Cypress in repo | Critical flows: sign-in, trade accept, listing create |
| API routes | Some route tests | IDOR + PII stripping tests after Phase 0 |

Add tests for: `requireOwnedProfileSession`, `apiFetch`, `uploadImage`, security regressions.

Run `npm run validate` after each phase.

### 5.3 Knip dead-code pass

`npx knip` after dedup — remove unused exports (merged typeaheads, audit logger, etc.).

### 5.4 i18n

New user-facing strings → `messages/en.json` → `npm run i18n:sync` (es, fr, it).

---

## Additional improvements (not in original audit)

These were identified as valuable follow-ups for a healthier Next.js app long term.

### Routing, UX, and resilience

| Item | Notes |
|------|--------|
| **Route-level `loading.tsx`** | Only `app/perfume/[perfumeSlug]/loading.tsx` and `app/the-exchange/loading.tsx` exist — add for profile, exchange thread, admin heavy pages |
| **Route-level `error.tsx`** | Only root `app/error.tsx` — segment errors for profile/trades prevent full-app error boundary |
| **Suspense boundaries** | Wrap slow server components (recommendations, review list) in `<Suspense>` with skeletons |
| **URL state library** | Compare + exchange use multiple `useEffect` + `useSearchParams` chains — consider `nuqs` for typed URL state |
| **View Transitions** | Enabled in `next.config.ts` — audit reduced-motion preference (`prefers-reduced-motion`) |

### Observability and operations

| Item | Notes |
|------|--------|
| **Structured logging** | `utils/server/structured-log.server.ts` + `x-correlation-id` — ensure all API errors log correlation ID |
| **Web Vitals** | Report LCP/INP/CLS to analytics (Vercel Speed Insights or custom) |
| **Health check route** | `GET /api/health` for DB connectivity (cron/monitoring) |
| **Feature flags** | Env-based flags for scraper, exchange experiments without deploy |

### Caching and data

| Item | Notes |
|------|--------|
| **Sanity revalidation** | Tag-based `revalidateTag` on journal publish — verify all GROQ consumers invalidate |
| **`unstable_cache` / `cacheLife`** | Catalog pages (houses by letter, archive) may benefit from explicit cache policies |
| **Prisma connection** | Document pool sizing / PgBouncer for serverless; consider Prisma Accelerate if connection limits hit |
| **TanStack Query defaults** | Centralize `staleTime` / `gcTime` in `app/providers.tsx` per query type |

### Accessibility (a11y)

| Item | Notes |
|------|--------|
| **Focus management** | `hooks/useFocusTrap.ts` exists — ensure all `Modal` usages trap focus and restore on close |
| **Keyboard nav** | Exchange grids, compare tray, tab components (`ViewTabs`, `TabContainer`) — audit roving tabindex |
| **Live regions** | Alert/toast updates should use `aria-live` where not already (`AlertBell`, trade notifications) |
| **Motion** | GSAP animations — respect `prefers-reduced-motion` |

### SEO and metadata

| Item | Notes |
|------|--------|
| **Dynamic metadata** | Verify all public perfume/house/trader pages use `generateMetadata` + canonical URLs |
| **JSON-LD** | `lib/seo/` — keep in sync when listing schema changes |
| **Sitemap** | `app/sitemap.ts` — include trader profiles and journal posts if indexable |

### PWA and offline

| Item | Notes |
|------|--------|
| **Service worker** | `public/sw.js` + `ServiceWorkerRegistration` — document cache strategy; version bump on deploy |
| **Push notifications** | `docs/testing-web-push.md` — ensure permission UX is not shown repeatedly |

### Type safety and API contracts

| Item | Notes |
|------|--------|
| **Shared API types** | Export response types from `models/` or `types/` for client `apiFetch` generics |
| **Zod on API bodies** | Most routes use validation — audit remaining routes for raw `request.json()` |
| **Strict null checks** | Avoid optional chaining masking missing session user in server actions |

### Real-time and polling

| Item | Notes |
|------|--------|
| **SSE or WebSocket** | Replace 30s polling for alerts/DM with push or SSE (lower load, faster UX) |
| **React Query `refetchInterval`** | If keeping poll, use RQ interval + `refetchIntervalInBackground: false` |

### Dual auth entry points

| Item | Notes |
|------|--------|
| **Server Actions vs REST** | Prefer one pattern per domain (e.g. profile → actions, mobile-friendly → API) — document in `server-layers.md` |
| **Sign-in path consistency** | `SignInClient` at `app/(auth)/SignInClient.tsx` vs `sign-up/SignUpClient.tsx` in subfolder — align file layout |

---

## Implementation order (PR checklist)

1. **Security PR** — Phase 0 + tests  
2. **Profile auth helper** — Phase 1.1  
3. **API client + CSRF + upload unify** — Phase 1.2  
4. **Compare duplicate fetch fix** — Phase 3.1  
5. **Unread provider merge** — Phase 2.1  
6. **Inline fetch → lib/queries** — Phase 2.6  
7. **TraderActionButton + lightbox + profile list layout** — Phase 2.2–2.5  
8. **Root layout client boundary split** — Phase 3.2  
9. **List memoization** — Phase 3.3  
10. **Validation schema + audit logger merge** — Phase 1.4  
11. **Large module splits** — Phase 4.2 (one file per PR)  
12. **Docs + knip + server-layers.md** — Phase 5  

---

## Out of scope (unless explicitly requested)

- Full migration from `useFormState` to Conform  
- Redis rate limiting implementation (plan only in Phase 0.5)  
- Prisma migrate vs `db push` policy change (see `database-migrations.md` and `.cursor/rules`)  
- Rewriting `notes-graph.ts` behavior (split structure only)  
- Product features from `FUTURE_IDEAS.md` / `CUSTOMER_FEATURES_BACKLOG.md`  

---

## Success criteria

- [ ] No public API returns user emails  
- [ ] All comment/listing mutations verify ownership  
- [ ] Profile pages use `requireOwnedProfileSession` (zero duplicated auth blocks)  
- [ ] Compare page performs one perfume fetch on load  
- [ ] Root layout client JS measurably reduced (bundle analyzer)  
- [ ] Single unread polling provider with visibility-aware interval  
- [ ] Knip reports no duplicate utility files (`formValidationSchemas`, audit logger)  
- [ ] `npm run validate` passes after each merged PR  
- [ ] `docs/server-layers.md` exists and matches team conventions  

---

## Appendix: duplication hotspots (quick reference)

| Pattern | Occurrences | Consolidation target |
|---------|-------------|----------------------|
| Profile auth block | 8 `page.tsx` files | `requireOwnedProfileSession` |
| `getCsrfHeader` in mutations | 4 files | `lib/api-client.ts` / `useCSRF` export |
| Image upload clients | 3 files | `uploadImage()` |
| Unread polling | 3 modules | `UnreadCountsProvider` |
| Trader modal buttons | 4+ components | `TraderActionButton` |
| House typeahead fetch | 2 components | Single typeahead |
| `fetch` vs `lib/queries` | ReviewSection, PerfumeRatingSystem | React Query hooks |
| Admin create/edit shell | 4 clients | `AdminFormPageShell` |

---

*Generated from codebase review (Next.js 16 / React 19). Update this doc when phases complete or priorities shift.*
