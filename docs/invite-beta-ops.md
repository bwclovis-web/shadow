# Invite-beta ops checklist

Manual gates that sit beside product Phases A–D. Check off in production before opening invite.

## Observability

- [ ] `SENTRY_DSN` set on Vercel (preview + prod)
- [ ] Trigger a test exception; confirm event in Sentry with correlation id
- [ ] CSP remains Report-Only until Studio / analytics are clean ([next.config.ts](../next.config.ts))

## Stripe + membership

- [ ] Live `STRIPE_PRICE_ID_MEMBER` / `_PREMIUM` / `_COLLECTOR` + webhook secret
- [ ] One checkout each tier → webhook → `subscriptionStatus` / tier on user
- [ ] Cancel / update subscription updates the user row
- [ ] `npm run backfill:early-adopters -- --dry-run` then apply on prod before free cap

## Growth surfaces

- [ ] Search Console: submit `sitemap-index.xml`; request index on `/`, Archive, Houses, quiz, compare
- [ ] Publish Sorce journal batch ([journal-sorce-launch.md](./journal-sorce-launch.md))
- [ ] Email smoke ([live-testing.md](./live-testing.md))
- [ ] Push smoke ([testing-web-push.md](./testing-web-push.md))

## Incident readiness

- [ ] Owner knows [incident-response.md](./incident-response.md)
- [ ] Scraper pause path verified once in staging/admin
