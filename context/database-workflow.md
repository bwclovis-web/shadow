# Database workflow

## 2026-08-23 — Use Prisma Migrate (not `db push`)

**Owner preference:** Schema changes are versioned under `prisma/migrations/`.

- Local (authoring): `npx prisma migrate dev --name <name>` then `npm run db:generate` if needed
- Local / CI / prod (apply pending): `npx prisma migrate deploy`
- Do **not** use `prisma db push` for routine schema work

Canonical docs: [`docs/database.md`](../docs/database.md). Cursor rule: `.cursor/rules/prisma-migrations-only.mdc`.

### History

- **2026-05-18** — Temporary preference for `db push` (superseded).
