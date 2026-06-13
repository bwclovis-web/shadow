# Server Layer Boundaries

This document defines where server-side code belongs in the Perfumer's Hollow codebase. The goal is to keep API routes thin and push business logic into predictable layers.

## Layer overview

| Layer | Responsibility | Example |
|-------|----------------|---------|
| `models/*.server.ts` | Prisma access and domain rules for a bounded context | `trade.server.ts`, `user-inventory.server.ts` |
| `services/` | Pure computation and orchestration with no direct I/O | `recommendations/`, `trade-match/` |
| `lib/queries/` + `lib/mutations/` | Client-side fetch, cache keys, and TanStack Query hooks | `houses.ts`, `follow.ts` |
| `utils/**/*.server.ts` | Cross-cutting infrastructure (auth, CSRF, email, sanitization) | `auth.server.ts`, `sanitize.server.ts` |

## `models/` — domain and persistence

- Owns Prisma queries, transactions, and entity-specific validation.
- Encodes business rules: ownership checks, publish constraints, reputation side effects.
- May call `utils/**/*.server.ts` for infra helpers (hashing, slugs, sanitization).
- Should **not** import React, client hooks, or browser APIs.

Split large model files by subdomain rather than by CRUD verb:

- `user-profile.server.ts` — auth, trader profile, password
- `user-inventory.server.ts` — collection, destash, listing amounts
- `user-comments.server.ts` — listing comments
- `perfume-catalog.server.ts` — list/catalog pagination
- `perfume-detail.server.ts` — slug/id reads
- `perfume-search.server.ts` — name search
- `perfume-mutations.server.ts` — admin create/update/delete
- `perfume-exchange.server.ts` — exchange discovery and decanting queries

`models/user.server.ts` and `models/perfume.server.ts` remain as **barrel re-exports** so existing imports keep working.

## `services/` — pure logic

- Functions that transform data or apply scoring rules without touching the database directly.
- May receive already-fetched records from `models/` or API routes.
- Good fit for recommendation scoring, trade-match ranking, and testable algorithms.

## `lib/queries/` and `lib/mutations/` — client data layer

- Browser-only fetch helpers used by React components and hooks.
- Centralize CSRF headers, error parsing, and React Query key factories.
- Must not import `models/*.server.ts` (server-only modules).

## `utils/**/*.server.ts` — infrastructure

- Reusable helpers with no product-domain ownership: sessions, rate limits, email transport, audit logging.
- Safe for API routes and `models/` to import.
- Prefer `utils/security/` for auth-adjacent code and `utils/server/` for request-scoped helpers.

## API routes (`app/api/**`)

API route handlers should:

1. Authenticate and authorize (`utils/server/auth.server.ts`, role guards).
2. Validate input (Zod schemas, `utils/api-validation.server.ts`).
3. Delegate to `models/` or `services/`.
4. Map domain results to HTTP responses.

Avoid embedding Prisma queries or multi-step business rules directly in route files. If a route grows beyond auth + validation + a single model call, extract a model function.

## Scraper pipeline (`lib/scraper/`)

The note-extraction LangGraph pipeline splits into:

- `notes-graph.ts` — public API re-exports only
- `stages/pipeline-options.ts` — options and LangGraph state
- `stages/pdp-bootstrap.ts` — URL/name resolution, PDP HTTP bootstrap
- `stages/title-cleaning.ts` — title cleaning, sanitization, structured note parsing
- `stages/llm-extraction.ts` — LLM extract / merge
- `stages/noir-description.ts` — film noir copy
- `stages/note-translation.ts` — non-English note translation
- `stages/note-validator.ts` — bulk note validator
- `stages/extract-notes-node.ts` — graph node and orchestration

Stages may share helpers via explicit exports; keep the public entry point at `notes-graph.ts`.

## Quick decision guide

| Question | Put it in |
|----------|-----------|
| "Does this touch Prisma for a specific entity?" | `models/` |
| "Is this a pure function over in-memory data?" | `services/` |
| "Does the browser fetch this from `/api`?" | `lib/queries/` or `lib/mutations/` |
| "Is this auth, CSRF, email, or sanitization?" | `utils/**/*.server.ts` |
| "Is this only used inside one API route?" | Still prefer `models/` if it encodes domain rules |

## Related docs

- [Database schema sync](./database-migrations.md)
- [Data quality dashboard](./data-quality-dashboard/README.md)
