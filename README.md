# perfumer's hollow

Next.js App Router fragrance archive, exchange, and collector tools.

## Documentation

**Start here:** [docs/README.md](./docs/README.md) — single documentation hub (setup, database, architecture, quality, ops, product).

## Quick start

```bash
cp scripts/env.example .env   # set DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:generate
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Schema policy: **Prisma Migrate** only — see [docs/database.md](./docs/database.md).

## Common commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Next.js |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e:seed && npm run test:e2e` | Playwright (see [docs/e2e.md](./docs/e2e.md)) |
| `npm run db:migrate:dev -- --name <name>` | Author a schema migration |
| `npm run db:migrate` | Apply pending migrations (local) |
| `npm run db:migrate:prod:dry` | Preview prod pending migrations |
| `npm run db:migrate:prod` | Apply pending migrations (prod) |
| `npm run db:studio` | Prisma Studio (local) |
| `npm run db:backup` | Prisma-based backup to `./backups/` |

## Maintenance scripts

Many workflows live under `scripts/` and npm scripts in `package.json`. Highlights:

- **Backups:** `db:backup` / `db:restore` (Prisma) or `db:backup:pg` / `db:restore:pg` (needs `pg_dump`)
- **House notes refresh:** `npm run refresh:house-notes` (needs `OPENAI_API_KEY`)
- **Scraper issues:** [docs/scraper-troubleshooting.md](./docs/scraper-troubleshooting.md)

Full script inventory: [scripts/COMMANDS-REFERENCE.md](./scripts/COMMANDS-REFERENCE.md).
