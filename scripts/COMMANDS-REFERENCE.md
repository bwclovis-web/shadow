# Scripts commands reference

## Related docs

- Database / migrations: `docs/database.md`
- Docs hub: `docs/README.md`
- Note materials (non-destructive): `scripts/NOTE-MATERIALS.md`

## Note materials

| Command | Database changes | Notes |
|---------|------------------|-------|
| `npm run notes:seed-materials` | Adds/updates `NoteMaterial` and `NoteMaterialAlias` only | Safe to re-run; never deletes `PerfumeNotes` |
| `npm run notes:materials:report` | None (read-only) | Writes report under `reports/` |

Typical flow after schema changes:

```bash
npm run db:migrate:dev -- --name <name>
npm run db:generate
npm run notes:seed-materials
npm run notes:materials:report
```

## Database / schema (package.json)

| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Apply pending migrations (local / CI) |
| `npm run db:migrate:dev -- --name <name>` | Author a new migration |
| `npm run db:migrate:status` | Show migration history vs DB |
| `npm run db:migrate:prod:dry` | Preview prod pending migrations |
| `npm run db:migrate:prod` | Apply pending migrations to `REMOTE_DATABASE_URL` |
| `npm run db:migrate:remote:cli -- "<url>"` | Apply migrations to an arbitrary Postgres URL |
| `npm run db:serve` | `migrate deploy` then studio + docs + dev |
| `npm run db:studio` / `db:studio:prod` | Prisma Studio (local / prod) |
| `npm run db:fingerprint` | Compare local vs remote schema markers |

## Other script commands (package.json)

| Command | Purpose |
|---------|---------|
| `npm run notes:fixture` | Run note pipeline fixture tests |
| `npm run refresh:house-notes` | Refresh house perfume notes from descriptions |
| `npm run db:backup` | Backup database before risky operations |

## Deprecated: note cleanup scripts

Scripts that **deleted or merged** `PerfumeNotes` were moved to `scripts/archive/note-cleanup-legacy/`. Do not use them; use note materials instead.

Former `npm run clean:notes:*` commands are no longer defined in `package.json`.
