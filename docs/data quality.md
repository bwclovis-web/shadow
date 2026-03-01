# Data Quality Dashboard Improvement Plan

## Goal
Improve the admin data quality dashboard so it is secure, reliable, actionable, and easy to use for ongoing cleanup operations.

---

## Quick Wins (1 Day)

### P0: Secure Admin Endpoints
- Add auth/session and role checks to:
  - `GET /api/data-quality`
  - `GET /api/data-quality-houses`
- Ensure only `admin` and `editor` can access dashboard data.

**Acceptance Criteria**
- Unauthenticated request returns unauthorized behavior (`401` or redirect flow used by your app).
- Authenticated non-admin/editor returns `403` (or app-standard unauthorized response).
- Admin/editor receives `200` with valid payload.
- Full house export is not publicly accessible.

---

### P0: Stabilize CSV Upload Flow
- Current upload posts to `/api/update-house-info`.
- Implement that route or temporarily disable/hide upload UI until route is ready.

**Acceptance Criteria**
- Upload action never results in 404.
- Valid CSV returns structured success response.
- Invalid CSV returns row-level errors (clear enough for user correction).

---

### P1: Improve Loading UX
- Use full-page loading only for initial fetch (`isLoading`).
- During background refetch (`isFetching`), keep content visible and show subtle refreshing indicator.

**Acceptance Criteria**
- Changing timeframe does not blank the dashboard.
- User sees existing data while refresh is in progress.
- Refresh state is clearly visible but non-disruptive.

---

### P1: Align Missing-Info Rules Across API + UI
- Define one canonical required-fields list for “missing info”.
- Ensure API logic and UI copy refer to the same fields.

**Acceptance Criteria**
- Counts in summary cards match table/filter behavior.
- UI text accurately reflects backend validation fields.
- Spot-checking sample records confirms metric correctness.

---

### P1: Replace Alert/Reload Pattern
- Replace `alert()` and `window.location.reload()` with inline status/toasts + query invalidation.

**Acceptance Criteria**
- Upload success and error messages appear in-app.
- Dashboard refreshes data without hard page reload.
- User context (selected filter/timeframe) is preserved after upload.

---

## Phase 2 Roadmap (2-4 Weeks)

### Data Correctness Hardening
- Normalize duplicate detection keys (`trim`, lowercase, collapse whitespace).
- Consider optional punctuation-insensitive matching.

**Acceptance Criteria**
- Variations like `Acqua Di Gio` vs `acqua  di gio` are grouped as duplicates.

---

### Actionable Diagnostics
- Return missing field names per house (`missingFields: string[]`) instead of just counts.

**Acceptance Criteria**
- Table shows exactly which fields are missing for each house.
- Admin can resolve issues without guessing.

---

### Real Trend History
- Persist daily quality snapshots.
- Populate `historyData` from real historical records.

**Acceptance Criteria**
- Trend chart displays actual week/month/all trajectories.
- Data remains consistent across page reloads and deployments.

---

### Localization Pass
- Move hardcoded dashboard copy to `next-intl` messages.

**Acceptance Criteria**
- Card labels, tab labels, table headers, button text, and helper text are translatable.
- Dashboard follows current locale.

---

### Type Safety Cleanup
- Remove `any` from dashboard-related components and API response handling.
- Share DTO/types between API and UI where appropriate.

**Acceptance Criteria**
- Type errors catch shape mismatches before runtime.
- Dashboard compiles cleanly with strict TypeScript checks.

---

### Prioritization UX
- Add severity scoring for issues.
- Default sort by highest-impact records first.

**Acceptance Criteria**
- Top entries represent highest cleanup impact.
- Severity rationale is clear and documented.

---

## Recommended Execution Order
1. Secure endpoints.
2. Fix upload route availability.
3. Improve loading/refetch behavior.
4. Align missing-info definitions.
5. Replace alert/reload interactions.
6. Add missing field details and typing.
7. Add trend snapshot persistence.
8. Add severity-based prioritization.
9. Complete localization.

---

## Implementation Checklist

### Phase 1 (Quick Wins)
- [ ] Add admin/editor auth guard to `GET /api/data-quality`.
- [ ] Add admin/editor auth guard to `GET /api/data-quality-houses`.
- [ ] Add tests (or manual verification notes) for 401/403/200 route behavior.
- [ ] Implement `/api/update-house-info` OR disable upload button until implemented.
- [ ] Validate uploaded CSV schema and return row-level errors.
- [ ] Update dashboard loading logic: first-load spinner only.
- [ ] Add non-blocking “Refreshing...” indicator during refetch.
- [ ] Define canonical required fields for “missing house info”.
- [ ] Update API logic to use canonical required fields.
- [ ] Update UI text to exactly match canonical required fields.
- [ ] Replace `alert()` usage in CSV flow with inline status/toast.
- [ ] Remove `window.location.reload()` and refresh via query invalidation.

### Phase 2 (Quality + Scale)
- [ ] Normalize duplicate key generation (trim/lower/collapse whitespace).
- [ ] Add optional stronger normalization rules (if needed).
- [ ] Return `missingFields` array per house from API.
- [ ] Render missing fields in house issues table.
- [ ] Persist daily data-quality snapshots.
- [ ] Populate `historyData` from persisted snapshots.
- [ ] Internationalize all dashboard hardcoded strings.
- [ ] Remove `any` from dashboard and API response consumers.
- [ ] Add shared response types for data-quality endpoints.
- [ ] Add severity score model and default sorting by severity.

### Verification Checklist
- [ ] Unauthorized users cannot access data-quality API payloads.
- [ ] Admin users can view and export data successfully.
- [ ] Upload path is stable (no 404) and returns useful errors.
- [ ] Timeframe switches do not blank dashboard content.
- [ ] Metrics and explanatory text are consistent with backend rules.
- [ ] Trend chart displays real history (when snapshots are enabled).
- [ ] Dashboard works in supported locales.
- [ ] No TypeScript or lint regressions introduced.

---

## Done Definition
- Admin-only access is enforced for all data-quality endpoints.
- Dashboard stays usable during refetch and upload operations.
- Metrics are trustworthy, consistent, and documented.
- Upload/download workflows are reliable and actionable.
- Team can prioritize and resolve highest-impact issues efficiently.
