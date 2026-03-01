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

### Phase 2 manual testing

1. **Cookie issuance**  
   - Open the app in a browser (any page).  
   - In DevTools → Application → Cookies, confirm a cookie named `_csrf` is set for the site (value is a long hex string).

2. **Valid token (happy path)**  
   - Log in (or use an authenticated session).  
   - Perform a protected action that uses CSRF (e.g. sign out via logout button, add to wishlist, submit a review, change password, or admin: create tag / delete perfume / delete house).  
   - Action should succeed (no 403).

3. **Missing token (403)**  
   - With the app loaded and `_csrf` cookie present, open DevTools → Network.  
   - In Console, run a mutation without sending the token, e.g.:  
     `fetch('/api/log-out', { method: 'POST', credentials: 'include' })`  
   - Response should be **403** and body message like "Invalid security token".

4. **Wrong token (403)**  
   - Run a mutation with a wrong token in the header, e.g.:  
     `fetch('/api/log-out', { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': 'wrong' } })`  
   - Response should be **403** and same message.

5. **Form submissions**  
   - Use a form that includes the CSRF hidden field (e.g. sign-in, sign-up, create perfume).  
   - Submit the form; it should succeed.  
   - Submit the same form from a copy that omits the `_csrf` field or uses a different token; server should respond with 403 or show "Invalid security token" in the form error state.

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

### Phase 4 manual testing

1. **Unauthenticated user → sign-in**  
   - Sign out (or use an incognito window with no session).  
   - Visit any admin URL, e.g. `/admin/users`, `/admin/create-perfume`, `/admin/security-monitor`.  
   - You should be **redirected to `/sign-in?redirect=%2Fadmin`** (or similar).  
   - After signing in, you should land on `/admin` (or the intended admin page if the app supports it).

2. **Authenticated non-admin (e.g. editor or regular user) → unauthorized**  
   - Sign in as a user whose role is **not** `admin` (e.g. `editor` or normal user, if you have test accounts).  
   - Visit any admin URL, e.g. `/admin/users`, `/admin/data-quality`.  
   - You should be **redirected to `/unauthorized`** and must not see admin content.

3. **Authenticated admin → full access**  
   - Sign in as an **admin** user.  
   - Open each admin route and confirm the page loads (no redirect):  
     - `/admin/users`  
     - `/admin/create-perfume`  
     - `/admin/create-house`  
     - `/admin/data-quality`  
     - `/admin/pending-submission`  
     - `/admin/audit-stats`  
     - `/admin/rate-limit-stats`  
     - `/admin/security-stats`  
     - `/admin/security-monitor`  
     - `/admin/performance-admin`  
   - Confirm no flash of content before redirect (protection happens in the layout before children render).

4. **No token-presence-only bypass**  
   - With dev tools, ensure there is **no** cookie named `accessToken` (or clear it).  
   - Visit `/admin/users`.  
   - You should still be redirected to sign-in (middleware no longer gates on cookie presence; the layout’s `requireAdminSession` does the real check).

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

- [x] Phase 1 complete
- [x] Phase 2 complete
- [ ] Phase 3 complete
- [x] Phase 4 complete
- [ ] Phase 5 complete
- [ ] Phase 6 complete
- [ ] Validation + rollout complete

