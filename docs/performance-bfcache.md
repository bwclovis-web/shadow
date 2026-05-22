# Back/forward cache (bfcache) — current limits

Lighthouse may report that `/` cannot use the back/forward cache. As of the homepage performance work, some causes are mitigated; others require a larger architecture change.

## Mitigated in code

- **Anonymous `/api/auth/refresh` 401:** `useTokenRefresh` only runs when a `refreshToken` cookie is present (`Providers` + `app/layout.tsx`). Logged-out visitors no longer trigger a failed refresh request on load.

## Still blocks full bfcache eligibility

### Document `Cache-Control: no-store`

The root layout and `i18n/request.ts` call `cookies()` on every request (session, locale, CSRF). Next.js serves the HTML document as **dynamic**, which typically includes headers that prevent bfcache storage for the main resource.

**Possible follow-up (not implemented):**

- Route groups, e.g. `(marketing)` with a layout that does not read cookies for public pages like `/`, while `(app)` keeps session-aware layout.
- Next.js Cache Components / PPR when the app is ready to adopt them for mixed static + personalized shells.

### Other `no-store` fetches

Any in-page `fetch` to routes or APIs that return `Cache-Control: no-store` can still disqualify bfcache until those calls are removed, deferred, or given cacheable private headers where safe. Logged-in-only calls (e.g. activity ping) do not affect anonymous homepage audits.

## Manifest critical path

`/manifest.webmanifest` is discovered after HTML. It is small (~0.44 KiB). Improving LCP and JS payload shrinks the navigation leg of the chain; removing `appleWebApp` metadata is optional if audits still flag the chain after other wins.

## Verification

1. Logged out: Network tab on `/` — no `POST /api/auth/refresh`.
2. Logged in with refresh cookie: refresh still runs after ~1s and on interval.
3. Lighthouse → bfcache / cache diagnostics: document `no-store` may remain until a public static shell exists.
