# Database workflow

## 2026-05-18 — Use `db push`, not migrate

**Owner preference:** Schema changes are applied with `npm run db:push` after editing `prisma/schema.prisma`, then `npm run db:generate`. Do not use `prisma migrate dev` / `migrate deploy` for routine work.

The Cursor rule `.cursor/rules/prisma-migrations-only.mdc` was updated to reflect this (filename is legacy).
