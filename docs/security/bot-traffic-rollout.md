# Perfumer's Hollow bot traffic rollout

## Evidence and scope

October 17, 2026 firewall screenshot: approximately 192.6k allowed requests over the previous day, with 168.2k claiming Lightpanda/1.0. User agents are spoofable; this does not identify an operator. No production firewall changes are included in this PR.

## Dashboard changes (operator)

Project: https://vercel.com/arcanum-hollow/perfumers-hollow/firewall

1. Open Bot Management. Set Bot Protection to Log and save. Review matched traffic for legitimate visitors, verified search crawlers, link previews and integrations. Only switch to Challenge after reviewing false positives and testing a preview deployment. Log mode does not stop traffic.
2. Add a custom rule named `Observe Lightpanda production traffic`, with ALL conditions: Host equals `perfumershollow.com`, Environment equals `production`, User Agent contains `Lightpanda/`. Action: Log. Review the draft and publish it yourself. Inspect matched paths, request methods, IPs and rate. Exclude any authorized automation. Do not block an entire JA4 or country based on this incident.
3. If confirmed unwanted, validate the same condition with Challenge on preview first (use the preview host/environment in a separate test rule). Then change the production rule to Challenge or Deny and publish. Revert to Log or disable the rule if legitimate traffic is affected. A user-agent rule is only a narrow first layer; clients can change their user agent.
4. Stage separate per-IP rate limits for GET/HEAD catalog HTML (`/perfume/`, `/houses/`, `/the-archive`) and GET search/catalog APIs (inspect `/api/perfume`, `/api/perfume-houses`, `/api/perfumes-by-letter`, `/api/more-perfumes`, `/api/perfumeSortLoader`). Begin in Log with generous thresholds based on observed legitimate bursts (5–10 times normal), then test preview before enforcing. Do not apply browser challenges blindly to JSON APIs, webhooks or cron routes. Exempt verified crawlers using platform verification rather than trusting their user-agent strings. Distributed clients can evade per-IP limits.
5. Check allowed/denied counts, function invocations, database load and real signup/search behavior after each change. Record thresholds, matching counts and any false positives before tightening.

## Code deployment prerequisites

- Configure both `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` on the intended Vercel production environment, using a Turnstile widget authorized for the production hostname. Do not paste secrets into issues or logs.
- Missing either key now rejects protected production form submissions. Non-production can still skip verification when no secret is set. Test preview with a correctly configured widget before merging.
- Run `npm run validate:env` with `NODE_ENV=production` in the production configuration. This command reports variable names; do not share its full output without reviewing it.
- No database migration is required. The existing PostgreSQL RateLimitBucket table is used. The limiter now increments/resets a bucket and returns its count in one parameterized INSERT ... ON CONFLICT statement, avoiding read/check/update races.
- Existing process-local fallback on DB failure remains; it is not a distributed enforcement guarantee. Firewall limits remain the first line against high-volume crawls.
- Before production, run a concurrency check against an isolated PostgreSQL test database: 50 simultaneous calls with a fresh key and maxRequests=5 must admit exactly 5 and reject 45 with HTTP 429; repeat after window expiry and with an existing expired bucket. Do not use a live production database for this check.
- Keep existing public-data caching and authenticated personalization separation. No blanket noindex, login gate, or shared caching of user data is introduced.

## Rollback

Disable the new firewall rules or return them to Log. If Turnstile causes legitimate failures, verify widget hostname and both keys first; reverting this PR restores the previous missing-secret behavior. Reverting the limiter requires no schema rollback.

## Validation for this change

- TypeScript `tsc --noEmit`: passed.
- New focused tests: 11 passed. Existing signup tests: 4 passed.
- ESLint for changed TypeScript: passed. Environment script is ignored by the repository ESLint configuration.
- Executed the actual parameterized limiter SQL with embedded PostgreSQL (PGlite), 50 concurrent requests at limit 5: exactly 5 admitted and 45 rejected, for fresh and expired windows. This supplements, but does not replace, a check with the deployed Prisma/PostgreSQL connection. No production database was used.
- Tests required a temporary Vitest config disabling PostCSS discovery because the existing PostCSS plugin configuration fails under Vitest. This temporary config is not part of the PR.
- Four existing sign-in tests fail on both the unchanged baseline and this branch; they expect redirects that are not reached. These failures are not introduced by this change.
