# Database schema changes (migrations only)

Shadow and Sillage uses **Prisma Migrate** with checked-in SQL under `prisma/migrations/`. We **do not** use `prisma db push` for schema changes.

## Why migrations

- Every schema change is reviewed, versioned, and reproducible across machines and environments
- Production and local stay aligned by applying the same migration history
- Avoids drift from ad-hoc `db push` runs

## Local development

### You changed `prisma/schema.prisma`

```bash
npx prisma migrate dev --name add_user_push_subscription
npm run db:generate   # migrate dev usually runs generate; safe to repeat
```

Restart `npm run dev` if Prisma client errors persist (Windows file locks).

### You pulled someone else's migrations

```bash
npx prisma migrate deploy
npm run db:generate
```

### New computer / empty local database

See `docs/new computer set up.md` — after `.env` and PostgreSQL are ready:

```bash
npm run db:generate
npx prisma migrate deploy
```

## Production / remote

Apply pending migrations only (no reset):

```bash
npx prisma migrate deploy
```

Use the production `DATABASE_URL` (or your team's documented deploy process). Review migration SQL before applying to shared databases.

For historical notes on an older prod push script, see `docs/production-schema-sync.md` — **prefer `migrate deploy`** for schema sync unless you have a specific reason to use the legacy script.

## Commands reference

| Task | Command |
|------|---------|
| Create migration + apply locally | `npx prisma migrate dev --name <name>` |
| Apply pending migrations | `npx prisma migrate deploy` |
| Migration status | `npx prisma migrate status` |
| Regenerate client | `npm run db:generate` |
| Prisma Studio (local) | `npm run db:studio` |

## Do not use for schema changes

- `prisma db push`
- `npm run db:push`

## Agent / contributor note

Cursor rule: `.cursor/rules/prisma-migrations-only.mdc` (always applied).

When adding features that need new tables or columns, always add a migration file — do not document or run `db push` as the apply step.
