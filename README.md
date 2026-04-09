This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Docs

- Production schema/table sync guide: `docs/production-schema-sync.md`
- New machine onboarding guide: `docs/new computer set up.md`

## Special Scripts (Maintenance / Data)

Many workflows in this repo are run via Node/Prisma helper scripts in `scripts/` and via npm scripts in `package.json`.

### Database backups and restores

These scripts load `.env` and use `DATABASE_URL`.

Backups are written to `./backups/` by default. You can override the output/input folder with `BACKUPS_DIR`.

Run these from the repo root.

Prisma-based (no PostgreSQL client tools required):
- `npm run db:backup`
  Creates a Prisma-based backup set in `backups/` (SQL + JSON + manifest). Restore can re-populate the DB using the generated SQL/JSON.
- `npm run db:restore:list`
  Lists available Prisma backup manifests in `backups/`.
- `npm run db:restore -- <backupNameSubstring> --clear`
  Restores the matching backup (substring match against the backup manifest filename). Use `--clear` to wipe existing table data before restoring.

Postgres-client based (requires `pg_dump` + `psql`/`pg_restore` available on your machine):
- `npm run db:backup:pg`
  Runs `pg_dump` and writes a full backup set (schema + data variants plus a custom dump) plus a manifest.
  - Optional: set `PG_DUMP_PATH` if `pg_dump` is not on your PATH.
- `npm run db:restore:pg:list`
  Lists available Postgres-client backup manifests in `backups/`.
- `npm run db:restore:pg -- <backupNameSubstring> --clean --create`
  Restores the matching backup. `--clean` clears objects first; `--create` allows `pg_restore --create`.

### Refresh house notes (LangGraph extraction)

Rebuilds note relations and (optionally) film-noir descriptions for a single perfume house using the existing DB descriptions.

Requirements:
- `OPENAI_API_KEY` set in `.env`
- `DATABASE_URL` set in `.env`

Examples:
- `npm run refresh:house-notes`
  Prompts for a house name (default is `Heretic Parfum`).
- `npm run refresh:house-notes -- "Other House"`
  Runs for the provided house name.
- `npm run refresh:house-notes -- --dry-run`
  Shows what would be updated, without writing changes.
- `npm run refresh:house-notes -- --no-noir`
  Extracts notes but skips generating film noir descriptions.

### Merge duplicate CocoaPink / ` - cc pink` perfumes

This is a one-off migration that:
1. Finds CocoaPink perfumes with names ending in ` - cc pink`
2. Merges user references to the canonical (non-suffixed) perfume
3. Deletes the duplicate perfume rows

Run:
- `npx tsx scripts/merge-cocoapink-cc-pink-duplicates.ts --dry-run`
  Safe preview: prints what would be merged without making DB changes.
- `npx tsx scripts/merge-cocoapink-cc-pink-duplicates.ts`
  Performs the merge + delete in a transaction.

### Scraper troubleshooting

If the scraper hits connection resets, pagination issues, missing notes, or route timeouts, see:
- `docs/scraper-troubleshooting.md`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
