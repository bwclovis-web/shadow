# Database

Canonical schema and database ops for this repo. Hub: [README.md](./README.md).

**Policy:** Prisma Migrate with checked-in SQL under `prisma/migrations/`. Do **not** use `prisma db push` for routine schema work.

---

## Why migrations

- Every schema change is reviewed, versioned, and reproducible
- Local, CI, and production apply the same history
- Avoids drift from ad-hoc `db push` runs

---

## Local development

### You changed `prisma/schema.prisma`

```bash
npm run db:migrate:dev -- --name add_descriptive_name
npm run db:generate   # migrate usually runs generate; safe to repeat
```

Restart `npm run dev` if Prisma client errors persist (Windows file locks).

### You pulled someone else's migrations

```bash
npm run db:migrate
npm run db:generate
```

### New / empty local database

See [getting-started.md](./getting-started.md):

```bash
npm run db:generate
npm run db:migrate
```

---

## Production / remote

Apply pending migrations only (no reset):

```bash
npm run db:migrate:prod:dry   # preview (REMOTE_DATABASE_URL)
npm run db:migrate:prod       # apply
```

Or with explicit env: `DATABASE_URL=$REMOTE_DATABASE_URL npx prisma migrate deploy`

### Studio: local vs production

| Command | Target |
|---------|--------|
| `npm run db:studio` | Local (`DATABASE_URL`) |
| `npm run db:studio:prod` | Production (`REMOTE_DATABASE_URL` from `.env`) |

Both open UI at `http://localhost:5555`; the DB target is env-driven.

Compare targets: `npm run db:fingerprint`.

---

## Commands reference

| Task | Command |
|------|---------|
| Create migration + apply locally | `npm run db:migrate:dev -- --name <name>` |
| Apply pending migrations (local) | `npm run db:migrate` |
| Migration status | `npm run db:migrate:status` |
| Prod preview / apply | `npm run db:migrate:prod:dry` / `db:migrate:prod` |
| Regenerate client | `npm run db:generate` |
| Prisma Studio (local) | `npm run db:studio` |
| Prisma Studio (prod URL) | `npm run db:studio:prod` |
| Fingerprint local vs remote | `npm run db:fingerprint` |
| Dev stack (migrate + studio + docs) | `npm run db:serve` |

---

## Do not use for schema changes

- `prisma db push` (no npm script — use migrate commands above)
- `prisma migrate reset` (destructive — only if user explicitly requests)
- Data-copy scripts for schema (e.g. `db:migrate:accelerate` copies rows; it is not a schema path)

---

## Backups and restores

Scripts load `.env` and use `DATABASE_URL`. Default folder: `./backups/` (override with `BACKUPS_DIR`).

**Prisma-based** (no `pg_dump` required):

```bash
npm run db:backup
npm run db:restore:list
npm run db:restore -- <backupNameSubstring> --clear
```

**Postgres client** (needs `pg_dump` / `psql` / `pg_restore`):

```bash
npm run db:backup:pg
npm run db:restore:pg:list
npm run db:restore:pg -- <backupNameSubstring> --clean --create
```

---

## Agent / contributor note

Cursor rule: `.cursor/rules/prisma-migrations-only.mdc` (always applied).

When adding features that need new tables or columns, always add a migration — do not document or run `db push` as the apply step.
