# Production Schema Sync

This project has two separate workflows:

- Schema changes (tables/columns/indexes/constraints): use `db:push:prod`
- Data migration (copying rows): use `scripts/migrate-to-accelerate-fixed.js`

Do not use the data migration script for schema changes.

## Commands

- Preview (safe dry run, prints SQL only):
  - `npm run db:push:prod:dry`
- Apply schema sync to production:
  - `npm run db:push:prod`
- Open Prisma Studio against production explicitly:
  - `npm run db:studio:prod`
- Open Prisma Studio against local DB:
  - `npm run db:studio`
- Compare local/prod DB targets quickly:
  - `npm run db:fingerprint`

## Studio: Local vs Production

- `npm run db:studio` uses your default local connection (`DATABASE_URL` from local env setup).
- `npm run db:studio:prod` forces Studio to use `REMOTE_DATABASE_URL` from `.env`.
- Prisma Studio always opens at `http://localhost:5555` for both commands.  
  The URL is local UI only; the database target is determined by the command/env.

## Table Sync Runbook (No Data Loss)

Use this exact flow when local has new tables/columns and production must match:

1. Preview what will run:
   - `npm run db:push:prod:dry`
2. Apply additive schema sync:
   - `npm run db:push:prod`
3. Verify production markers:
   - Check the `Verification result` JSON printed by `db:push:prod`
4. Confirm visually in production Studio:
   - `npm run db:studio:prod`
5. If local/prod still look inconsistent:
   - `npm run db:fingerprint`
   - Compare `urlHash`, `host`, and marker booleans

## Environment Notes

- Schema sync scripts in this repo load variables from `.env`.
- Next.js runtime commonly uses `.env.local` first, but these sync scripts do not.
- For schema sync correctness, keep `REMOTE_DATABASE_URL` in `.env` accurate.
- If production app behavior differs from local scripts, compare:
  - Vercel `DATABASE_URL` (Production env)
  - local `.env` `REMOTE_DATABASE_URL`

## How It Works

`db:push:prod` runs `scripts/push-prod-schema.js`, which:

1. Loads `REMOTE_DATABASE_URL` from `.env`
2. Executes `prisma/migrations/APPLY_TO_REMOTE_DB.sql` against production
3. Runs a verification query and prints whether key production schema items exist:
   - `ScentProfile` table
   - `TraderContactMessage` table
   - `User.subscriptionStatus` column
   - `UserPerfumeReview.isApproved` column

`db:push:prod:dry` runs the same script in `--dry-run` mode and prints the SQL that would run, without changing the database.

`db:fingerprint` prints comparable fingerprints for `LOCAL_DATABASE_URL` and `REMOTE_DATABASE_URL`, including:

- host
- url hash (safe short hash of full URL)
- key schema markers (`ScentProfile`, `TraderContactMessage`, `User.subscriptionStatus`, `UserPerfumeReview.isApproved`)
- `public` table count

## Troubleshooting

- `db:push:prod` says success but columns still missing in Studio:
  - Run `npm run db:studio:prod` (not `db:studio`)
  - Run `npm run db:fingerprint` to ensure you are checking the same target
- Prisma web Studio (`console.prisma.io`) looks different from local prod Studio:
  - Usually a different Prisma project/environment/branch target
  - Treat `db:studio:prod` + `db:fingerprint` as source of truth for script target
- Existing relation/constraint errors during sync:
  - Re-run `npm run db:push:prod` after pulling latest migration SQL updates
  - Migration file is idempotent and safe to rerun

## Safety Notes

- The SQL file is additive/idempotent and intended to avoid data loss.
- Never add destructive SQL (drop table/column or irreversible type changes) to `APPLY_TO_REMOTE_DB.sql`.
- Keep `prisma/schema.prisma` as the source of truth for model definitions.
- Use `db:studio:prod` (not `db:studio`) when verifying production, to avoid accidental local DB checks.
- Use `db:fingerprint` when local Studio and Prisma web Studio appear inconsistent.
