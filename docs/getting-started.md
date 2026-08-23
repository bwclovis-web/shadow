# Getting started (new machine)

Get the app running on a new computer, including local PostgreSQL and migrations.

## 1) Prerequisites

- Node.js `20.x` (LTS)
- npm
- Git
- PostgreSQL `15+`

Optional: pgAdmin / TablePlus; Prisma Studio via `npm run db:studio`.

## 2) Clone and install

```bash
git clone <your-repo-url> shadows
cd shadows
npm install
```

## 3) Create local database

```bash
psql -U postgres -h localhost -c "CREATE DATABASE new_scent;"
```

Use any DB name; keep `.env` consistent.

## 4) Create `.env`

```bash
cp scripts/env.example .env
```

Minimum:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/new_scent"
LOCAL_DATABASE_URL="postgresql://postgres:password@localhost:5432/new_scent"
JWT_SECRET="replace-with-random-64+-char-secret"
SESSION_SECRET="replace-with-random-64+-char-secret"
NODE_ENV="development"
```

Notes:

- `DATABASE_URL` — Prisma + app runtime
- `LOCAL_DATABASE_URL` — some sync/fingerprint scripts
- `REMOTE_DATABASE_URL` — only for prod Studio / legacy sync scripts
- Optional: `OPENAI_API_KEY`, Stripe, Resend (`RESEND_API_KEY`, `EMAIL_FROM`), VAPID (see [testing-web-push.md](./testing-web-push.md)), R2, Sanity

## 5) Generate client + apply migrations

This project uses **Prisma Migrate** (not `db push`). See [database.md](./database.md).

```bash
npm run db:generate
npm run db:migrate
```

## 6) Optional: restore data

```bash
npm run db:restore:list
npm run db:restore -- <backupNameSubstring>
```

## 7) Start

```bash
npm run dev
```

- App: `http://localhost:3000`
- Studio: `npm run db:studio` → `http://localhost:5555`

## 8) Verify

```bash
npm run typecheck
npm run test
```

## 9) Sanity (journal, optional)

1. `npm run sanity:login` and create a project; set `NEXT_PUBLIC_SANITY_PROJECT_ID` + `NEXT_PUBLIC_SANITY_DATASET`
2. Add CORS origins for `http://localhost:3000` and production
3. `npm run sanity:check` / `npm run sanity:dev` or embedded `/studio`
4. Create Article documents; public journal at `/journal` when env is set

## Common issues

| Symptom | Fix |
|---------|-----|
| `JWT_SECRET environment variable is required` | Set `JWT_SECRET` in `.env` |
| Can't reach database | Postgres running? URL host/user/password correct? |
| Prisma schema mismatch | `npm run db:generate` then `npm run db:migrate` (or `db:migrate:dev` when authoring) |
| Wrong DB targeted | Check `DATABASE_URL` / `LOCAL_DATABASE_URL` / `REMOTE_DATABASE_URL` |

Production schema: [database.md](./database.md) — use `npm run db:migrate:prod`, not local onboarding scripts.
