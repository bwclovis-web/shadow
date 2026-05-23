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
- Email (Resend): `RESEND_API_KEY`, `EMAIL_FROM` — must include a verified address, e.g. `perfumer's hollow <alerts@shadowandsillage.com>` (not display name alone); verify sending domain in Resend dashboard
- Web Push (optional): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — generate keys with `node scripts/generate-vapid-keys.mjs` (testing guide: `docs/testing-web-push.md`)
- R2/Cloudflare storage variables (for image/storage scripts)
- Sanity (Behind the Bottle blog): see **Sanity setup** below. Run `npm run sanity:check` to verify env vars.

## 5) Generate Prisma client + apply migrations

This project uses **migrations only** (not `db push`). See `docs/database-migrations.md`.

Run:

```bash
npm run db:generate
npx prisma migrate deploy
```

This applies all migration SQL in `prisma/migrations/` to your local database.

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

## 9) Sanity setup (Behind the Bottle blog, optional)

1. Log in and create a project:

```bash
npm run sanity:login
npx sanity projects create "perfumer's hollow" --dataset production
```

Copy the **project ID** into `.env`:

```env
NEXT_PUBLIC_SANITY_PROJECT_ID="your-project-id"
NEXT_PUBLIC_SANITY_DATASET="production"
```

2. In [Sanity Manage](https://www.sanity.io/manage) → your project → **API** → **CORS origins**, add:

- `http://localhost:3000`
- Your production URL (e.g. `https://shadowandsillage.com`)

3. Verify and open the studio:

```bash
npm run sanity:check
npm run sanity:dev
```

Or use the embedded studio at `http://localhost:3000/studio` while `npm run dev` is running.

4. Create an **Article** in the studio (`title`, `slug`, `publishedAt`, `author`, `body`, optional `coverImage`, `perfumeRefs` / `houseRefs` slugs from this site).

5. Optional — on publish, call `POST /api/sanity/revalidate` with header `Authorization: Bearer <SANITY_REVALIDATE_SECRET>` to refresh cached pages (set `SANITY_REVALIDATE_SECRET` in `.env`).

Public blog: `/behind-the-bottle` (only when env vars are set). Perfume houses stay at `/houses`.

## 10) Common issues and fixes

- `JWT_SECRET environment variable is required`
  - Add `JWT_SECRET` to `.env` with a long random string.
- `Can't reach database server`
  - Confirm PostgreSQL is running and host/port/user/password in `DATABASE_URL` are correct.
- Prisma schema mismatch errors
  - Re-run `npm run db:generate` then `npx prisma migrate deploy` (or `npx prisma migrate dev` if you are authoring a new migration).
- Wrong DB targeted by scripts
  - Check `.env` and confirm `DATABASE_URL` / `LOCAL_DATABASE_URL` / `REMOTE_DATABASE_URL` values.

## 11) Production-only schema sync (do not run for local setup)

If you ever need production schema sync, follow:

- `docs/production-schema-sync.md`

For local onboarding, you do **not** need `db:push:prod` or `db:studio:prod`.
