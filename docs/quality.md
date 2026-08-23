# Quality & release gates

Hub: [README.md](./README.md). Playwright details: [e2e.md](./e2e.md).

## Automated tests (required before merge)

| Area | Coverage |
|------|----------|
| SSRF | `utils/server/safe-fetch-url.server.test.ts` — private IPs, localhost, credentials |
| Auth / logout | Session revocation bumps `tokenVersion` + revokes `RefreshSession` |
| Rate limits | Durable `RateLimitBucket` with memory fallback |
| Uploads | Avatar/listing/report routes rate-limit + FILE_UPLOAD audit |
| Scraper jobs | `ScraperJob` create/update/cancel via `/api/admin/scraper/jobs/[id]` |
| Note extraction | Existing fixture scripts (`npm run notes:fixture`) |

```bash
npm run test
```

## Playwright journeys

Specs under `e2e/smoke/` and `e2e/journeys/`:

1. Quiz → Scent DNA — `e2e/journeys/quiz-to-dna.spec.ts`
2. Recommendation feedback (“not for me”) — `e2e/journeys/recommendation-feedback.spec.ts`
3. Collection add — `e2e/journeys/collection-update.spec.ts`
4. Saved search Free 403 / Premium OK — `e2e/journeys/saved-search-entitlement.spec.ts`
5. Profile privacy (wishlist visibility) — `e2e/journeys/profile-privacy.spec.ts`
6. Membership tier unlock — `e2e/journeys/membership-tier.spec.ts`

```bash
npm run test:e2e:seed && npm run test:e2e
```

After schema changes: `npx prisma migrate deploy` (then seed). See [e2e.md](./e2e.md) and [database.md](./database.md).

## Performance & observability baselines

Targets for quality releases (measure before expanding membership benefits).

| Metric | Target | Notes |
|--------|--------|-------|
| p95 API route latency | ≤ 800ms | Authenticated catalog / exchange GETs |
| Max RSC payload (perfume detail) | ≤ 150 KB | After select projections |
| LCP | ≤ 2.5s | Real CWV from PerformanceDashboard |
| INP | ≤ 200ms | Prefer over FID |
| CLS | ≤ 0.1 | Layout shift |
| Scraper job success rate | ≥ 90% | Durable `ScraperJob` status |
| Alert delivery rate | ≥ 95% | Saved search + wishlist alerts |
| Premium activation (30d) | Track | Membership funnel |

Instrumentation:

- `utils/server/metrics.server.ts` — timing + counters
- `components/Organisms/PerformanceDashboard` — LCP/CLS/INP/FCP/TTFB
- `ScraperJob` model — progress, cancel, partial recovery

## Membership release policy

- Ship digital benefits behind `utils/feature-flags.ts`
- Measure Premium activation & 30-day retention before expanding Collector perks
- Never add product sales, checkout for goods, payouts, escrow, or transaction fees under this roadmap
