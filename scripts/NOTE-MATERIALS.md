# Note materials (non-destructive grouping)

Canonical scent materials (e.g. bergamot, patchouli) sit in `NoteMaterial` with optional `NoteMaterialAlias` rows linking existing `PerfumeNotes` — **no note names or perfume relations are changed**.

## Commands

```bash
# Apply schema (NoteMaterial tables + ScentProfile material fields)
npx prisma migrate deploy
# or when authoring: npx prisma migrate dev --name <name>
npm run db:generate

# Seed materials and aliases (safe to re-run)
npm run notes:seed-materials

# Read-only report: unmapped notes, coverage
npm run notes:materials:report
```

## Runtime behavior

- **Scent quiz** — users pick materials, not every raw note variant.
- **Recommendations / compare** — score perfumes when any linked note maps to a preferred material (DB alias or runtime rules in `lib/note-materials/rules.ts`).
- **New notes** — `createTag` persists a rule-based alias when the name matches; otherwise rules apply at scoring time.

## Deprecated

Legacy scripts that deleted or merged notes live under `scripts/archive/note-cleanup-legacy/`.
