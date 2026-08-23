# Performance & observability baselines

Targets for Shadow quality releases (measure before expanding membership benefits).

| Metric | Target | Notes |
|---|---|---|
| p95 API route latency | ≤ 800ms | Authenticated catalog / exchange GETs |
| Max RSC payload (perfume detail) | ≤ 150 KB | After select projections |
| LCP | ≤ 2.5s | Real CWV from PerformanceDashboard |
| INP | ≤ 200ms | Prefer over FID |
| CLS | ≤ 0.1 | Layout shift |
| Scraper job success rate | ≥ 90% | Durable `ScraperJob` status |
| Alert delivery rate | ≥ 95% | Saved search + wishlist alerts |
| Premium activation (30d) | Track | Membership funnel |

## Instrumentation

- `utils/server/metrics.server.ts` — timing + counters (structured logs)
- `components/Organisms/PerformanceDashboard` — real LCP/CLS/INP/FCP/TTFB
- `ScraperJob` model — progress, cancel, partial recovery
