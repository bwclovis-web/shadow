# Scripts commands reference

## Related docs

- Production schema/table sync: `docs/production-schema-sync.md`
- Note materials (non-destructive): `scripts/NOTE-MATERIALS.md`

## Note materials

| Command | Database changes | Notes |
|---------|------------------|-------|
| `npm run notes:seed-materials` | Adds/updates `NoteMaterial` and `NoteMaterialAlias` only | Safe to re-run; never deletes `PerfumeNotes` |
| `npm run notes:materials:report` | None (read-only) | Writes report under `reports/` |

Typical flow after schema changes:

```bash
npm run db:push
npm run db:generate
npm run notes:seed-materials
npm run notes:materials:report
```

## Other script commands (package.json)

| Command | Purpose |
|---------|---------|
| `npm run notes:fixture` | Run note pipeline fixture tests |
| `npm run refresh:house-notes` | Refresh house perfume notes from descriptions |
| `npm run db:backup` | Backup database before risky operations |

## Deprecated: note cleanup scripts

Scripts that **deleted or merged** `PerfumeNotes` were moved to `scripts/archive/note-cleanup-legacy/`. Do not use them; use note materials instead.

Former `npm run clean:notes:*` commands are no longer defined in `package.json`.
