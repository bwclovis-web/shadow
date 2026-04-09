# New Computer Set Up

This guide gets the project running on a brand-new computer, including local database setup.

## 1) Install prerequisites

Install these first:

- Node.js `20.x` (LTS recommended)
- npm (comes with Node)
- Git
- PostgreSQL `15+` (local install)

Optional but useful:

- pgAdmin or TablePlus (for local DB inspection)
- Prisma Studio (already available via npm script in this repo)

## 2) Clone and install dependencies

From the folder where you keep repos:

```bash
git clone <your-repo-url> shadows
cd shadows
npm install
```

## 3) Create local PostgreSQL database

Create a local database named `new_scent` (or use your own name, just keep `.env` consistent).

Example with `psql`:

```bash
psql -U postgres -h localhost -c "CREATE DATABASE new_scent;"
```

If your PostgreSQL user/password/host differ, update the command and later the `.env` values.

## 4) Create `.env` in repo root

This repo includes `scripts/env.example` with DB variables. Copy it to `.env`:

```bash
cp scripts/env.example .env
```

Then edit `.env` and set real values.

Minimum required for local dev:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/new_scent"
LOCAL_DATABASE_URL="postgresql://postgres:password@localhost:5432/new_scent"
JWT_SECRET="replace-with-random-64+-char-secret"
SESSION_SECRET="replace-with-random-64+-char-secret"
NODE_ENV="development"
```

Notes:

- `DATABASE_URL` is required by Prisma and app runtime.
- `LOCAL_DATABASE_URL` is used by some migration/sync scripts.
- `JWT_SECRET` is required by auth/session code.
- `REMOTE_DATABASE_URL` is only needed if you run remote/prod sync scripts (optional for local-only setup).

Optional service variables (only if you use those features):

- `OPENAI_API_KEY` (AI note refresh scripts)
- Stripe variables (`STRIPE_*`) for payments
- Email provider variables (for email flows)
- R2/Cloudflare storage variables (for image/storage scripts)

## 5) Generate Prisma client + apply schema

Run:

```bash
npm run db:generate
npm run db:push
```

This creates/updates your local schema based on `prisma/schema.prisma`.

## 6) (Optional) Load data into local DB

Choose one:

- If a backup already exists in `backups/`:

```bash
npm run db:restore:list
npm run db:restore -- <backupNameSubstring>
```

- If starting clean: skip this step.

## 7) Start app locally

```bash
npm run dev
```

Open:

- App: `http://localhost:3000`
- Prisma Studio (when needed): run `npm run db:studio` and open `http://localhost:5555`

## 8) Verify setup

Run:

```bash
npm run typecheck
npm run test
```

If both pass and the app opens at `localhost:3000`, your machine setup is complete.

## 9) Common issues and fixes

- `JWT_SECRET environment variable is required`
  - Add `JWT_SECRET` to `.env` with a long random string.
- `Can't reach database server`
  - Confirm PostgreSQL is running and host/port/user/password in `DATABASE_URL` are correct.
- Prisma schema mismatch errors
  - Re-run `npm run db:generate` then `npm run db:push`.
- Wrong DB targeted by scripts
  - Check `.env` and confirm `DATABASE_URL` / `LOCAL_DATABASE_URL` / `REMOTE_DATABASE_URL` values.

## 10) Production-only schema sync (do not run for local setup)

If you ever need production schema sync, follow:

- `docs/production-schema-sync.md`

For local onboarding, you do **not** need `db:push:prod` or `db:studio:prod`.
