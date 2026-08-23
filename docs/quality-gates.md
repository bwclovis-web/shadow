# Quality & release gates

## Automated tests (required before merge)

| Area | Coverage |
|---|---|
| SSRF | `utils/server/safe-fetch-url.server.test.ts` — private IPs, localhost, credentials |
| Auth / logout | Session revocation bumps `tokenVersion` + revokes `RefreshSession` |
| Rate limits | Durable `RateLimitBucket` with memory fallback |
| Uploads | Avatar/listing/report routes rate-limit + FILE_UPLOAD audit |
| Scraper jobs | `ScraperJob` create/update/cancel via `/api/admin/scraper/jobs/[id]` |
| Note extraction | Existing fixture scripts (`npm run notes:fixture`) |

Run: `npm run test`

## Playwright journeys (target suite)

Add under `e2e/` when expanding CI:

1. Signup → scent quiz → profile recommendations
2. Recommendation feedback (“not for me”) hides card
3. Collection add / destash update
4. Saved search create (Premium entitlement 403 for free)
5. Profile privacy toggles
6. Subscribe webhook → `membershipTier=premium`

## Measurable targets

See `docs/performance-baselines.md`.

## Membership release policy

- Ship digital benefits behind `utils/feature-flags.ts`
- Measure Premium activation & 30-day retention before expanding Collector perks
- Never add product sales, checkout for goods, payouts, escrow, or transaction fees under this roadmap
