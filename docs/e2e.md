# Playwright E2E

Chromium smoke + quality-gate journeys. Unit Vitest stays separate (`npm run test`).

## Prerequisites

1. Local Postgres with `DATABASE_URL` in `.env`
2. `JWT_SECRET` set (any 32+ char secret for local)
3. Leave `TURNSTILE_SECRET_KEY` **unset** so sign-in skips Turnstile
4. Prefer `npm run build && npm run start` (or let Playwright start `npm run start` after a build). Dev (`next dev`) works but is slower/flakier (HMR, cold compiles). Specs use `domcontentloaded` + 1 worker; CI uses production.

## One-time / after schema changes

```bash
npm run db:push
npm run test:e2e:seed
npx playwright install chromium
```

Seed upserts:

- `e2e-free@example.com` (free)
- `e2e-premium@example.com` (premium)
- `e2e-admin@example.com` (admin)
- Minimal house/perfumes + public shelf + wishlist rows
- Writes `e2e/.auth/seed-meta.json` (gitignored)

Default password: `E2eTestPass1!` (override with `E2E_USER_PASSWORD`).

## Run locally

```bash
# Terminal A (or let Playwright start the server)
npm run build && npm run start

# Terminal B
npm run test:e2e:seed
npm run test:e2e
```

UI mode:

```bash
npm run test:e2e:ui
```

Auth storage states are written to `e2e/.auth/*.json` by the Playwright `setup` project on each run.

## Specs map

| Doc journey | Spec |
|-------------|------|
| Smoke sign-in / archive / exchange / admin / membership | `e2e/smoke/*` |
| Signup→quiz→DNA (signed-in quiz → DNA) | `e2e/journeys/quiz-to-dna.spec.ts` |
| Recommendation feedback | `e2e/journeys/recommendation-feedback.spec.ts` |
| Collection update | `e2e/journeys/collection-update.spec.ts` |
| Saved search Free 403 / Premium OK | `e2e/journeys/saved-search-entitlement.spec.ts` |
| Profile privacy (wishlist visibility) | `e2e/journeys/profile-privacy.spec.ts` |
| Membership tier unlock | `e2e/journeys/membership-tier.spec.ts` |

## CI

GitHub Actions job `e2e` in `.github/workflows/ci.yml` uses a Postgres service, seeds, builds, and runs Playwright. It does not block the unit `validate` job.
