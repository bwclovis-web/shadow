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

## Playwright journeys

See [`docs/e2e.md`](./e2e.md). Specs live under `e2e/smoke/` and `e2e/journeys/`:

1. Quiz → Scent DNA — `e2e/journeys/quiz-to-dna.spec.ts`
2. Recommendation feedback (“not for me”) — `e2e/journeys/recommendation-feedback.spec.ts`
3. Collection add — `e2e/journeys/collection-update.spec.ts`
4. Saved search Free 403 / Premium OK — `e2e/journeys/saved-search-entitlement.spec.ts`
5. Profile privacy (wishlist visibility) — `e2e/journeys/profile-privacy.spec.ts`
6. Membership tier unlock — `e2e/journeys/membership-tier.spec.ts`

Run: `npm run test:e2e:seed && npm run test:e2e`

## Measurable targets

See `docs/performance-baselines.md`.

## Membership release policy

- Ship digital benefits behind `utils/feature-flags.ts`
- Measure Premium activation & 30-day retention before expanding Collector perks
- Never add product sales, checkout for goods, payouts, escrow, or transaction fees under this roadmap
