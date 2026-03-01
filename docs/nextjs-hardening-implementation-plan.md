# Next.js Hardening Implementation Plan

## Goals

- Eliminate critical auth/CSRF vulnerabilities and unsafe mutation patterns.
- Implement durable session invalidation with a hybrid token/session strategy.
- Improve performance hotspots (admin tools, global providers, heavy list rendering).
- Reduce long-term maintenance risk by removing auth drift and tightening typing.

## Phase 1: Critical Security Lockdown

- Replace unauthenticated `GET` mutation endpoints with authenticated, role-protected `POST/DELETE` handlers:
  - `app/api/deletePerfume/route.ts`
  - `app/api/deleteHouse/route.ts`
  - `app/api/createTag/route.ts`
- Enforce admin/editor authorization in those routes using shared auth helpers.
- Standardize mutation response shape and stop returning internal/raw error details.
- Add strict pagination bounds (`skip/take/limit`) to prevent expensive unbounded reads:
  - `app/api/more-perfumes/route.ts`
  - `app/api/perfumes-by-letter/route.ts`
  - `app/api/houses-by-letter-paginated/route.ts`

## Phase 2: CSRF Enforcement (Double-Submit)

- Implement real CSRF validation in `utils/server/csrf.server.ts`:
  - compare CSRF cookie (`_csrf`) with request header (`x-csrf-token`) and/or form `_csrf`
  - use timing-safe comparison
  - fail closed with `403` on missing/mismatch
- Ensure token issuance/propagation stays aligned with:
  - `hooks/useCSRF.ts`
  - `components/Molecules/CSRFToken/CSRFTokenProvider.tsx`
- Enforce CSRF checks across all cookie-auth mutation routes and server actions.

## Phase 3: Session Hardening (Hybrid Strategy)

- Add persistent refresh/session tracking in Prisma (session table + revocation metadata):
  - `prisma/schema.prisma`
  - `utils/security/session-manager.server.ts`
  - `utils/security/session-config.server.ts`
- Keep short-lived access JWTs but bind refresh tokens to persisted sessions.
- Implement refresh-token rotation and immediate revocation of replaced tokens.
- Make `invalidateSession` and `invalidateAllUserSessions` perform real revocation.
- Align password-change messaging/behavior:
  - `models/user.server.ts`
  - `app/api/change-password/route.ts`

## Phase 4: Admin/Auth Consistency

- Normalize admin route protection with `requireAdminSession`:
  - `app/admin/create-perfume/page.tsx`
  - `app/admin/create-house/page.tsx`
  - `app/admin/users/page.tsx`
  - `utils/requireAdmin.server.ts`
- Harden `middleware.ts` (avoid token-presence-only checks) or limit middleware responsibility and rely on strict server-side auth checks.

## Phase 5: Performance Improvements

- Load React Query Devtools only in development:
  - `app/providers.tsx`
- Render only active performance admin panel (instead of mounting all tools):
  - `app/admin/performance-admin/PerformanceAdminClient.tsx`
  - `components/Performance/LazyPerformanceComponents.tsx`
  - `components/Performance/ConditionalPerformanceLoader.tsx`
- Reduce duplicated session lookups and root dynamic overhead:
  - `app/layout.tsx`
  - `app/perfume/[perfumeSlug]/page.tsx`
  - `app/houses/[houseSlug]/page.tsx`
- Add pagination/virtualization strategy for large collections:
  - `app/[userSlug]/profile/my-scents/page.tsx`
  - `app/[userSlug]/profile/my-scents/MyScentsPageClient.tsx`
  - `components/Molecules/VirtualScrollList/VirtualScrollList.tsx`

## Phase 6: Code Quality and Drift Reduction

- Consolidate token/auth codepaths into one canonical implementation:
  - `lib/auth/tokens.ts`
  - `lib/auth/session.ts`
  - `utils/security/session-manager.server.ts`
- Replace `any`-heavy query contracts with explicit DTOs:
  - `lib/queries/perfumes.ts`
  - `lib/queries/houses.ts`
  - `lib/queries/user.ts`
- Break oversized performance components into smaller, testable units.

## Validation and Rollout

- Add/expand tests for:
  - route authz (`401/403`)
  - CSRF pass/fail paths
  - session rotation/revocation lifecycle
  - method constraints + pagination bounds
- Roll out in stages:
  1. Phase 1 + 2 security hotfix
  2. Phase 3 session architecture
  3. Performance and quality phases
- Add post-release checks in security/performance admin pages to confirm no regressions.

## Execution Checklist

- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Phase 5 complete
- [ ] Phase 6 complete
- [ ] Validation + rollout complete

