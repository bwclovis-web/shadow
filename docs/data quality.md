# Data Quality Dashboard Improvement Plan

## Goal

Improve the admin data quality dashboard so it is secure, reliable, actionable, and easy to use for ongoing cleanup operations.

---

## Database schema (trend snapshots)

The `DataQualityDailySnapshot` model in [`prisma/schema.prisma`](../prisma/schema.prisma) powers trend history on the dashboard.

**This repo uses `prisma db push` (not `migrate`) to sync schema.** After pulling changes that touch Prisma:

```bash
npx prisma db push
npx prisma generate
```

Schedule `GET /api/cron/data-quality-snapshot` daily (with `CRON_SECRET`) so `historyData` is populated.

---

## Quick Wins (1 Day)

### P0: Secure Admin Endpoints

- Add auth/session and role checks to `GET /api/data-quality` and `GET /api/data-quality-houses`.
- Ensure only `admin` and `editor` can access dashboard data.

**Status:** Implemented (`requireAdminOrEditorApi` on both routes).

### P0: Stabilize CSV Upload Flow

- `POST /api/update-house-info` with CSRF + admin/editor auth, CSV validation, row-level results.

**Status:** Implemented.

### P1: Improve Loading UX

- Full-page loading only on initial load; subtle “Refreshing…” on refetch (`keepPreviousData`).

**Status:** Implemented.

### P1: Align Missing-Info Rules

- Canonical rules in [`lib/data-quality/rules.ts`](../lib/data-quality/rules.ts) (perfume + house fields).

**Status:** Implemented; UI copy aligned via i18n and `housesWithMissingHouseInfo`.

### P1: Replace Alert/Reload Pattern

- Inline status on CSV upload/download; query refresh instead of `window.location.reload()`.

**Status:** Implemented.

---

## Phase 2 (partially done)

- Daily snapshots + cron: **done** (model, `upsertTodayDataQualitySnapshot`, `/api/cron/data-quality-snapshot`).
- Trend empty state: **done** (`TrendChart`).
- Admin edit + public links with `slug`: **done** (`HousesWithNoPerfumes`).
- Optional severity scoring / default sort: **not implemented** (future).

---

## Phase 3

- i18n (`en` / `es` / `fr` / `it` under `dataQuality.*`): **done**.
- Shared DTO in [`lib/queries/dataQuality.ts`](../lib/queries/dataQuality.ts): **done**.
- Tests: dashboard + chart utils + config updated; optional dedicated API route tests for `update-house-info` still optional.

---

## Implementation Checklist

### Phase 1

- [x] Admin/editor auth on `GET /api/data-quality` and `GET /api/data-quality-houses`
- [x] `POST /api/update-house-info` with validation and row results
- [x] Dashboard loading: initial spinner only; refetch indicator
- [x] Canonical missing-field rules + structured `housesWithMissingHouseInfo`
- [x] Duplicate key normalization
- [x] CSV: no `alert` / no full-page reload for success path

### Phase 2

- [x] Normalize duplicate keys
- [x] `missingFields` per house in API + UI
- [x] Persist snapshots (`DataQualityDailySnapshot`) — apply schema with **`prisma db push`**
- [x] `historyData` from snapshots
- [x] Trend empty-state copy
- [x] Internationalize dashboard strings
- [x] Shared `DataQualityStats` / `DataQualityHouseRow` types
- [ ] Severity score + default sort (optional)

### Verification

- [x] Metrics consistent with `lib/data-quality/rules.ts`
- [x] Timeframe change does not blank dashboard (placeholder data)
- [ ] Manual: cron + `CRON_SECRET` on deployed environment
- [x] Supported locales include `dataQuality` strings

---

## Done Definition

- Admin/editor access is enforced for data-quality endpoints.
- Dashboard stays usable during refetch and upload operations.
- Metrics match documented rules; schema for snapshots applied via **`db push`** in this project.
- Upload/download workflows return actionable errors.
- Operators can open admin edit links from house issue rows.
