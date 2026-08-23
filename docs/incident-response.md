# Incident response (invite beta)

Short severity matrix and recovery paths for perfumer's hollow production.

## Severity

| Level | Examples | Response |
|-------|----------|----------|
| **SEV-1** | Site down, auth broken, data leak, Stripe webhook failing for all paid signups | Page owner; pause risky jobs; status note if public |
| **SEV-2** | Scraper stuck / mass 5xx on Exchange or Archive; email/push delivery outage | Fix or disable cron/worker; notify if lasting >1h |
| **SEV-3** | Single-feature bug, thin SEO coverage, one bad house scrape | Ticket; next business day |

## First 15 minutes

1. Confirm environment (Vercel deployment, `NEXT_PUBLIC_APP_URL`, DB fingerprint via `npm run db:fingerprint` if needed).
2. Check Sentry (if `SENTRY_DSN` set) and Vercel runtime logs for correlation IDs from `utils/errorHandling.ts`.
3. Do **not** run destructive DB commands (`migrate reset`, truncate, force push schema).

## Scraper pause

- Stop `scraper:worker` / disable scraper cron in Vercel.
- Cancel open jobs from Admin → Scraper (`ScraperJob` cancel API).
- See [scraper-troubleshooting.md](./scraper-troubleshooting.md).

## Database

- Backups: `npm run db:backup` (local) — production backups per host policy.
- Restore list: `npm run db:restore:list` — only with explicit approval.
- Schema: Prisma Migrate only (`npm run db:migrate` / `db:migrate:prod`). Never `db push` as default.

## Paid signup / Stripe

- Verify webhook endpoint + `STRIPE_WEBHOOK_SECRET` on Vercel.
- Smoke: Member / Premium / Collector checkout → `/subscribe/success` → signup.
- Early adopters: `npm run backfill:early-adopters -- --dry-run` then without dry-run **once** before free cap.

## Email / push

- Resend: [live-testing.md](./live-testing.md)
- Web push: [testing-web-push.md](./testing-web-push.md)

## SEO after deploy

- [seo-post-deploy.md](./seo-post-deploy.md) — robots, sitemap-index, Search Console.
