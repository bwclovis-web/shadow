# Destash / decant reliability improvements

Plan and contract for fixing volume allocation, pause/resume, and writer consistency across destash listings and group splits. **Functionality only** — page redesign is out of scope.

**Confirmed against local code** (branch `main`, inspection date 2026-10-20). Unrelated local edits (Exchange card/motion/i18n) must be left untouched.

---

## Contract (non-negotiable)

| Rule | Detail |
| --- | --- |
| Language | Keep **“destash”** and most existing copy keys (`myScents.destashManager`, list-item decant options). |
| Surfaces | Preserve routes, hero dimensions, page layout, theme, navigation, existing components, and supported actions. |
| Scope | This phase fixes reliability; **no** My Scents / Exchange visual redesign. |
| Features to keep | Inventory-first adding; multiple destashes per perfume; pause/resume; cash/trade/both; photos; conditions; formats; group splits. |
| Volume | **One** authoritative pourable-ml policy shared by all allocation writers. |
| Unknown owned | Unknown / unparseable owned volume must **not** silently mean unlimited. |
| Bottle scope | Do **not** invent bottle-specific allocation where only perfume-pooled data exists. |
| Security | Preserve authentication, ownership checks, CSRF, feature flags (`DECANT_SPLITS_ENABLED`), and follower/wishlist alerts. |
| Data safety | No production data edits, destructive cleanup, or migrations in this phase. |

---

## WORKFLOW

- Implement **only** the explicitly requested staged checklist step.
- After each step: report (1) files changed, (2) checks run, (3) preview route if UI, (4) remaining limitations; then **STOP**.
- Do **not** push, merge, deploy, edit production data, or author/apply migrations unless a later step explicitly requests a migrate-backed change (default: **none**).
- Preserve unrelated in-progress work; keep diffs scoped to destash/decant reliability.

---

## Exact file map

### Client — inventory add

| File | Role |
| --- | --- |
| `hooks/useMyScentsForm.ts` | CSRF FormData → `POST /api/user-perfumes` `action=add`; optimistic add/rollback. |
| `components/Containers/MyScents/MyScentsModal/MyScentsModal.tsx` | Search + manual entry; RangeSlider amount (max **250**); catalog add via hook; manual → `/api/user-perfumes/manual-entry`. |

### Client — destash / listings

| File | Role |
| --- | --- |
| `components/Containers/MyScents/DestashManager/DestashManager.tsx` | Create/edit/pause/resume/remove; `decant` vs `create-decant`; wires form `perfumeId` + Pause; embeds split wizard. |
| `components/Containers/MyScents/DeStashForm/DeStashForm.tsx` | Authoritative budget UI, amount slider, Pause, trade prefs, photos, condition, format, disclaimer. |
| `hooks/usePourableMlBudget.ts` | Client fetch of pourable budget for destash form. |
| `lib/destash-form-budget.ts` | Form max + validation aligned to server precision. |
| `app/api/user-perfumes/budget/route.ts` | `GET` pourable budget for destash form (same pool as splits). |
| `components/Containers/MyScents/DestashManager/DestashItem.tsx` | Active listing row; edit / soft-delete (pause) / comments. |
| `components/Containers/MyScents/DestashManager/PausedDestashItem.tsx` | Paused row; resume / clear pause. |
| `components/Containers/MyScents/MyListingsPanel.tsx` | Aggregate listings pause/resume via `postDecantListingAmount` (rollback on failure). |
| `lib/user-perfume-listing-actions.ts` | Shared `action=decant` POST helper. |
| `lib/resolve-listing-api-error.ts` | Maps `errorCode` / legacy photo messages to i18n. |
| `app/[userSlug]/profile/my-scents/[perfumeId]/MySingleScentClient.tsx` | Hosts `DestashManager` with `currentBottleId`; owned − listed remaining (no reserved). |

### Client — group splits

| File | Role |
| --- | --- |
| `components/Containers/MyScents/DecantSplit/DecantSplitWizard.tsx` | Three-step create wizard; budget states; draft retention; summary. |
| `hooks/useDecantSplitBudget.ts` | Flag-gated budget fetch for split wizard (`/api/decant-splits/budget`). |
| `lib/decant-split-wizard.ts` | Client volume/slot validation aligned to server precision. |
| `components/Containers/MyScents/DecantSplit/DecantSplitsPanel.tsx` | Mine list panel. |
| `app/splits/[splitId]/DecantSplitClient.tsx` | Claim / paid / ship / receive / cancel. |
| `utils/decant-splits-enabled.ts` | Client feature flag. |

### API

| File | Role |
| --- | --- |
| `app/api/user-perfumes/route.ts` | Auth + CSRF; `add` / `remove` / `decant` / `create-decant` / `update-bottle` / comments. |
| `app/api/user-perfumes/manual-entry/route.ts` | Manual catalog placeholder add. |
| `app/api/decant-splits/route.ts` | Create split (rate limit + Zod). |
| `app/api/decant-splits/budget/route.ts` | `GET` pourable budget. |
| `app/api/decant-splits/[splitId]/**` | Claim, paid, ship, received, cancel, detail. |
| `utils/decant-split-api-route.server.ts` | Flag gate, auth, CSRF, error HTTP map. |

### Domain / libs

| File | Role |
| --- | --- |
| `models/user-inventory.server.ts` | `addUserPerfume`, `createDestashEntry`, `updateAvailableAmount`, `updateUserPerfumeAmount`, `removeUserPerfume`. |
| `models/decant-split.server.ts` | Budget, create/claim/lifecycle; reserved ml from active splits. |
| `lib/decant-split-ml.ts` | `sumOwnedMl` / `sumListedMl` / `computePourableMlBudget`. |
| `lib/user-inventory.ts` | `parseMl`, bottle/listing/paused helpers, listing kind. |
| `models/listing-metadata.server.ts` | Parse/validate listing photos + metadata; R2 cleanup. |
| `models/user-perfume-pause.server.ts` | Raw SQL read/write `pausedAvailable`. |
| `models/user-perfume-listing-fields.ts` | Shared Prisma select for listing columns. |
| `utils/listing-config.server.ts` | `LISTING_REQUIRE_PHOTO` (default required). |
| `utils/listing-display.ts` | `DECANT_FORMATS` / `LISTING_CONDITIONS`. |
| `types/decant-split.ts` | Client DTOs including budget. |

### Bottle edit / other writers

| File | Role |
| --- | --- |
| `components/Containers/MyScents/MyScentListItem/bones/GeneralDetails.tsx` | `action=update-bottle` (amount/type/price/place). |
| `lib/csv-import-commit.ts` / `lib/csv-import-user.ts` | Inventory import; amount `"full"` normalization. |

### i18n / docs / tests

| File | Role |
| --- | --- |
| `messages/en.json` (+ `es`/`fr`/`it`) | `myScents.destashManager`, `myScents.listItem`, `decantSplits.wizard`, `listing.*`. |
| `docs/user-guide-decants.md` | Product copy for pourable ml formula. |
| `docs/smoke-test-decant-splits.md` | Manual split smoke. |
| `lib/user-inventory.test.ts` | Pure inventory helpers. |
| `lib/decant-split-ml.test.ts` | Pure budget math. |
| `app/api/user-perfumes/route.test.ts` | Route wiring (models mocked). |

**Preview routes (when UI steps run):**

- `/{userSlug}/profile/my-scents/[perfumeId]#destash`
- `/{userSlug}/profile/my-scents` (listings tab / My Listings)
- `/splits/[splitId]`
- `/the-exchange` (split chips; out of redesign scope here)

---

## Current behavior (code facts)

### Inventory-first add

1. User adds via My Scents modal → `action=add` → `addUserPerfume`.
2. Missing amount defaults to **`"full"`** (string), not a numeric ml.
3. `parseMl("full")` → **0** (letters stripped). That bottle contributes **0** to owned sums used by destash/split math.

### Destash create / update

1. **First** active listing while on a bottle page: `action=decant` updates that bottle row’s `available`.
2. **Additional** listings: `action=create-decant` → new row with `amount: "0"` and listing metadata.
3. Server validates `listed + new ≤ owned` **only when `totalOwned > 0`**. If owned parses to 0, the check is **skipped**.
4. Destash writers **do not** subtract active split `reservedMl`.
5. ~~Client `DeStashForm` 100 ml fallback~~ — **fixed Stage 2:** authoritative budget; no arbitrary max when unknown/failed.
6. ~~Client edit max omitted reserved~~ — **fixed Stage 2:** pool remaining (+ edit self-credit) from budget API.

### Multi-bottle UI heuristic

`getDestashedMlForBottle` in `DestashManager`:

- One collection bottle → attributes **all** perfume listed ml to that bottle.
- Multiple bottles → uses `source.available + standaloneDestashMl` only (does not allocate sibling bottles’ listed ml across the pool consistently).

Server create/update remain **perfume-pooled**. Bottle id on create is optional UX context (`sourceUserPerfumeId` for splits; first listing writes onto the bottle row).

### Pause / resume

1. Soft pause: set `available` to `"0"`, store prior ml in `pausedAvailable` (via raw SQL helpers).
2. Resume: `action=decant` with restored amount + `resumePaused=true`; photo publish rules relaxed on resume.
3. Clear paused: `amount=0` with no active available → clears pause + listing metadata/images.
4. DestashManager optimistic pause/remove **without** rollback on API failure; MyListingsPanel **does** roll back.

### Group splits

1. Budget: `owned − listed − reserved` (`lib/decant-split-ml` + `getReservedMlForPerfume` for statuses `open` | `filling` | `shipped`).
2. Create rejects `totalMl > remainingPourableMl`.
3. `sourceUserPerfumeId` is ownership-validated only; **not** used as a per-bottle ml ceiling.

### Bottle update / remove

1. `update-bottle` / `updateUserPerfumeAmount`: writes new `amount` with **no** check against listed + reserved.
2. `removeUserPerfume`: deletes the row (and comments/images) with **no** check for active listings/splits on that perfume.

### Listing metadata

- Publish (available > 0): photo required unless `LISTING_REQUIRE_PHOTO=false` or resuming paused.
- Condition / decantFormat optional at publish today.

### Product docs vs code

`docs/user-guide-decants.md` §6 states:

```text
pourable ml = owned ml − listed ml − reserved ml (active splits)
```

and that you cannot list **or** start another split beyond owned. **Listing writers do not enforce the reserved term today.**

---

## Findings (reliability gaps)

### P0 — Volume policy drift

1. **Unknown owned = unlimited:** `totalOwned > 0` gates in `createDestashEntry` / `updateAvailableAmount` skip caps when owned is 0 / `"full"` / unparseable.
2. **Destash ignores split reservations:** can list ml already reserved by an active group split.
3. **Three parsers / three policies:** ad-hoc `parseFloat(…replace…)`, `parseMl`, and `parseAmountToNumber` (`"full"` → null “unlimited” for *available* strings). Need one shared owned/listed/remaining helper used by every writer.

### P1 — Client / server mismatch

4. Destash UI maxAvailable omits reserved ml; can submit values the server should reject (or currently accepts incorrectly).
5. `maxAvailable === undefined` → slider max 100 (silent soft-unlimited UX).
6. Multi-bottle `getDestashedMlForBottle` invents bottle ceilings from incomplete attribution — conflicts with “pooled only” contract.

### P2 — Other writers / lifecycle

7. Reducing bottle `amount` below listed+reserved is allowed.
8. Deleting a bottle does not block or reconcile orphaned sibling destash rows / split source refs.
9. DestashManager pause/remove optimistic updates lack failure rollback (listings panel already correct).

### P3 — Consistency / maintainability

10. `user-perfume-pause.server.ts` still uses raw SQL though `pausedAvailable` exists on the Prisma model — technical debt (no migration this phase; optional Prisma client path later).
11. Unused destash i18n for source-bottle dropdown (`sourceBottleLabel`, etc.) while UI is `currentBottleId`-driven.
12. DecantSplitWizard uses raw `<input>` / `<select>` (atoms rule); defer unless a reliability step touches that form.
13. **No model/unit tests** asserting destash create/update reject over-allocation or unknown-owned; only pure lib + mocked route tests.

---

## Authoritative volume policy (target)

Adopt the user-guide formula everywhere allocation is written or capped (extended for completed pours):

```text
availableToAllocateMl = max(0,
  knownOwnedMl − activeDestashMl − reservedSplitMl − consumedCompletedSplitMl)
```

| Term | Definition |
| --- | --- |
| `knownOwnedMl` | Sum of **known** stored amounts only (`classifyStoredOwnedAmount`). |
| `activeDestashMl` | Sum of `available` on **active** listings. Exclude the row being edited via `excludeListingId`. Paused excluded. |
| `reservedSplitMl` | Sum of `totalMl` for host’s splits in `open` \| `filling` \| `shipped`. |
| `consumedCompletedSplitMl` | Sum of `totalMl` for host’s splits in `completed` (poured; must not return to pool). |

**Unknown owned:** if any owned amount is unknown, **reject** new/increased listings and new splits (`mayAllocate: false`). Soft-pause to 0 and clear-paused remain allowed.

**Bottle scope:** keep perfume-level pool for caps. Optional `sourceUserPerfumeId` / `currentBottleId` is metadata / first-listing row targeting only — not a separate ledger unless a later approved design adds real bottle allocations.

**Shared module (chosen — D7):** extend `lib/decant-split-ml.ts` (not a parallel `inventory-allocation` module).

Authoritative helpers (`lib/decant-split-ml.ts`) + server lock (`models/fragrance-pool-lock.server.ts`):

| Helper | Purpose |
| --- | --- |
| `computePooledFragranceAllocation` | Pooled budget with ownership, active destash, reserved, consumed-completed |
| `canAcceptAllocationMl` | Strict input parse + fit check |
| `withFragrancePoolTransaction` | `pg_advisory_xact_lock` + `FOR UPDATE` + bounded retries |
| `budgetFromFragrancePool` | Snapshot → pooled budget under lock |

**Wired (Stage 1b):** `createDestashEntry`, `updateAvailableAmount` (incl. resume / pause-to-zero), `createDecantSplit`, `getPourableMlBudget`, `updateUserPerfumeAmount` (reduction guard), `removeUserPerfume` (pool + source-split guard).

**Wired (Stage 2):** DestashManager / DeStashForm use `GET /api/user-perfumes/budget` + `lib/destash-form-budget.ts` (no 100 ml fallback; edit self-credit; pause action).

---

## Legacy-data policy (chosen)

| Stored `amount` | Treatment |
| --- | --- |
| `""`, `null`, `"0"`, numeric / numeric+`ml` | **Known** finite ml (read-only; values left unchanged) |
| `"full"`, `"partial"`, other tokens, malformed, negative, non-finite | **Unknown** ownership for that row |

Perfume-level ownership for allocation:

- Any unknown owned row → `ownership: "unknown"` → **`mayAllocate: false`** (never unlimited, never guessed).
- All known and `knownOwnedMl ≤ 0` → `ownership: "none"` → no positive allocation.
- All known and `knownOwnedMl > 0` → `ownership: "known"` → allocate against pool.

**No migration, no silent rewrite** of stored `amount` / `available` / `pausedAvailable` in this phase. Users must edit bottle amount to a numeric value before new positive allocations are accepted (once Stage 1b wires enforcement).

New inputs (`parseStrictAllocationMl`): digits + optional fraction only; reject units, tokens, negatives, NaN, Infinity.

---

## Split status → ml accounting

| Status | Treatment | Budget term |
| --- | --- | --- |
| `open`, `filling`, `shipped` | Reserves pourable ml | `reservedSplitMl` |
| `cancelled` | Released, nothing poured | neither reserved nor consumed |
| `completed` | Reservation clears; juice **was** poured | `consumedCompletedSplitMl` |

### Destash listing treatment

| State | Treatment |
| --- | --- |
| Active (`available` > 0) | Counts as `activeDestashMl` |
| Paused (`available` ≤ 0, `pausedAvailable` > 0) | **Does not** count (pool freed until resume re-checks) |
| Inactive / cleared | Does not count |

### Edit exclusion

When resizing a listing, pass `excludeListingId` so that row’s current `available` is omitted from `activeDestashMl` before the replacement volume is validated.

### Pooled vs source bottle

- **Caps:** always `scope: "pooled_fragrance"`.
- **`getSourceBottleAttribution`:** informational only (UX / metadata). Do not invent per-bottle allocation ledgers from pooled data.

---

## Completed-split poured volume (inspection + concrete fix)

**Established (current code):** `tryCompleteSplit` in `models/decant-split.server.ts` only sets status `completed` + `completedAt`. It does **not** reduce any `UserPerfume.amount`. Cancelled splits correctly free reservation with no pour.

**Bug if ignored:** when a split leaves `ACTIVE_DECANT_SPLIT_STATUSES`, `reservedMl` drops to 0 and the same ml becomes allocatable again even though it was poured.

**Concrete fix (implement when wiring Stage 1b — no inventory rewrite required):**

```text
availableToAllocate =
  knownOwnedMl − activeDestashMl − reservedSplitMl − consumedCompletedSplitMl
```

where `consumedCompletedSplitMl = sum(totalMl)` for host+perfume splits with status `completed` (`sumConsumedCompletedSplitMl`).

- Cancelled → not consumed.
- Completed → permanently consumes pourable budget until a later, explicit owned-amount reduction (optional product step; not this phase).
- **Stage 1b:** `getPourableMlBudget` and locked writers include `consumedCompletedSplitMl`. Completing a split still does **not** rewrite `UserPerfume.amount`; consumption is ledger-only via completed `totalMl` sums.

**Unresolved accounting (open):**

- Whether completing a split should also write down bottle `amount` (and how to pick a bottle without inventing ledgers) — deferred; ledger term above is the safe default (D8).
- Historical completed splits already reduce availability via read-only `totalMl` sums (no row rewrite).

---

## Staged checklist

### Stage 0 — Plan (this document) ✅

- [x] Inspect UI, APIs, models, pause, metadata, i18n, tests, other writers
- [x] Record file map, behavior, findings, verification, open decisions
- [x] Hub link from `docs/README.md`

### Stage 1a — Shared budget helpers (lib only) ✅

- [x] Extend `lib/decant-split-ml.ts` with pooled allocation + strict parse + status accounting
- [x] Explicit active/paused destash and reserving/cancelled/completed split treatment
- [x] Edit exclusion via `excludeListingId`
- [x] Unknown ownership explicit; legacy policy documented; no DB rewrite
- [x] One decimal precision / tolerance (`ML_DECIMAL_PLACES`, `ML_COMPARISON_TOLERANCE`)
- [x] Pooled vs source-bottle attribution distinguished
- [x] Document completed-split consumption fix (`consumedCompletedSplitMl`)
- [x] Focused unit tests (`lib/decant-split-ml.test.ts`)
- [x] **No** screen / mutation wiring; **no** migrations; **no** production data edits

### Stage 1b — Enforce on server writers ✅

- [x] Call pooled helpers from `createDestashEntry` and `updateAvailableAmount` (incl. resume)
- [x] Pass `reservedSplitMl` + `consumedCompletedSplitMl` under lock
- [x] Update `getPourableMlBudget` / `createDecantSplit` to the same formula
- [x] Reject unknown owned for new/increased listings; allow 0 for pause/clear/unpublish
- [x] Atomic validation+write via PostgreSQL `pg_advisory_xact_lock` + row `FOR UPDATE` + bounded retries (`withFragrancePoolTransaction`)
- [x] Structured `errorCode` responses (`lib/listing-allocation-errors.ts` + `listing.errors.*` i18n)
- [x] Alerts only after successful commit (outside retry loop)
- [x] Inventory reduction/removal guards (`updateUserPerfumeAmount`, `removeUserPerfume` + `sourceBottleInUse`)
- [x] Focused unit tests; optional DB concurrency test gated on `ALLOCATION_CONCURRENCY_TEST=1`
- [x] **No** migrations; **no** production data edits; **no** UI redesign

### Stage 2 — Client caps align with server ✅

- [x] DestashManager / DeStashForm: maxAvailable = remaining pourable (+ edit self credit); never fall back to 100 as “unlimited”
- [x] Fetch pourable budget via `GET /api/user-perfumes/budget` (same formula as splits: reserved + consumed-completed)
- [x] Compact owned / listed / reserved / available display; loading / failure / unknown with retry
- [x] Remove multi-bottle invented ceilings; use pool remaining only
- [x] Explicit Pause on edit; positive volume required for create; photo hint before submit
- [x] Revalidate budget on submit; keep edits on availability change; pending/error + a11y focus
- [x] Locales synced (`en`/`es`/`fr`/`it`); focused tests `lib/destash-form-budget.test.ts`
- [ ] Manual smoke on single-scent `#destash` create/edit (operator)

### Stage 3 — Destash mutations (form + pause/resume) ✅

- [x] Explicit price clear via present empty `tradePrice` (omit = leave unchanged)
- [x] Condition/format clear via empty fields on create/edit; pause/resume omit `images` so metadata is preserved
- [x] New destashes use clean listing fields (no copy of another listing’s photos/price/metadata)
- [x] Edit form uses a snapshot so parent refreshes cannot overwrite in-progress edits
- [x] Duplicate create/edit submit guarded; per-listing pending/error for pause/resume/remove
- [x] HTTP / network / malformed response handling; optimistic pause/remove rollback
- [x] Pause all awaits each result and reports partial failure
- [x] Failed create/edit keeps form values and photos
- [x] Focused tests: `lib/destash-form-payload.test.ts`
- [x] Labels/layout/API shape preserved; no duplicate-listing feature

### Stage 4 — Bottle update / remove guards ✅ (pulled into 1b)

- [x] `updateUserPerfumeAmount`: reject amount that would make commitments exceed known owned
- [x] `removeUserPerfume`: block when remaining pool would be oversubscribed or bottle is active split source
- [x] Unit coverage via `commitmentsExceedOwned` + allocation error mapping

### Stage 5 — Split wizard reliability ✅

- [x] Explicit budget loading / error / retry; no advance on invalid or excessive volume
- [x] Slot count integer within product bounds (1–24); positive finite slot sizes; totals match within server tolerance
- [x] Live slot sum + remaining budget; compact final-step summary
- [x] Preserve draft on back navigation and failed submit; duplicate-submit lock
- [x] Stale budget when perfume/source changes; refresh+retain draft on server budget conflict
- [x] Price-hint meaning and off-platform disclaimer unchanged; errors localized (`listing.errors` + wizard keys)
- [x] Focused tests: `lib/decant-split-wizard.test.ts`
- [ ] Manual smoke on `#destash` group-split create (operator)

### Stage 6 — Hardening / docs / i18n / verify ✅ (partial)

- [x] Destash + split wizard keys aligned with `listing.errors` where coded; locales synced (`i18n:diff` clean 2026-10-20)
- [x] Verification closeout recorded below (mocks vs DB vs browser)
- [ ] Update `docs/user-guide-decants.md` only if product wording must change (ledger vs bottle write-down still D8)
- [ ] Extend `docs/smoke-test-decant-splits.md` with destash over-allocation + pause cases (operator)
- [ ] Optional: DecantSplitWizard atoms (Select/Input) — deferred; not required for reliability

**Out of scope for this plan:** Exchange redesign, My Scents visual redesign, schema migrations, production backfills, inventing per-bottle ledgers.

---

## Existing commands and focused verification

### Commands already in repo

```bash
npm run test
npm run test:watch
npm run typecheck
npm run validate          # typecheck + test + knip
npm run i18n:diff
npm run i18n:sync
npm run test:e2e:seed && npm run test:e2e
npm run db:migrate:status # read-only status; do not migrate in this phase
```

### Focused unit targets (after Stage 1a+)

```bash
npx vitest run lib/decant-split-ml.test.ts lib/listing-allocation-errors.test.ts lib/destash-form-payload.test.ts lib/destash-form-budget.test.ts lib/decant-split-wizard.test.ts lib/user-inventory.test.ts models/fragrance-pool-lock.server.test.ts models/fragrance-pool-concurrency.integration.test.ts
```

Stage 1a/1b verified (2026-10-20): **42 passed, 1 skipped** (concurrency integration gated).

Stage 3 mutation helpers verified: `lib/destash-form-payload.test.ts` (+ related) **passed**.

Stage 2 form budget helpers verified (2026-10-20): `lib/destash-form-budget.test.ts` + payload tests.

Stage 5 split wizard helpers verified: `lib/decant-split-wizard.test.ts`.

**Verification re-run (2026-10-20):** focused suite **72 passed, 1 skipped** (see closeout). Route comment tests fixed (urlencoded `Content-Type`). `DeStashForm` ref-during-render lint warning fixed.

Preview: `/{userSlug}/profile/my-scents/[perfumeId]#destash` (group split wizard)

### Concurrency / locking evidence

| Item | Detail |
| --- | --- |
| Provider | PostgreSQL (`prisma` datasource) |
| Strategy | Transaction-scoped `pg_advisory_xact_lock(k1,k2)` on `(userId, perfumeId)` **plus** `SELECT … FOR UPDATE` on that user’s `UserPerfume` and relevant `DecantSplit` rows |
| Why not write-only tx | Budget is re-read under the same lock before insert/update; competing writers block on the advisory lock |
| Retries | Up to 4 attempts on P2034 / deadlock-like errors; alerts fire only after success |
| Default tests | Unit tests prove budget + commitment math; **they do not prove cross-connection serialization** |
| DB proof | `ALLOCATION_CONCURRENCY_TEST=1` + isolated DB → `models/fragrance-pool-concurrency.integration.test.ts` (two concurrent `createDestashEntry` of 40 ml on a 50 ml pool → exactly one success) |

### Stage 1b locking note (Accelerate / poolers)

`pg_advisory_xact_lock` is **transaction-scoped** and is intended to work with transaction-mode pooling (including Prisma Accelerate) as long as the lock and the writes share one interactive `$transaction`. Session-level advisory locks were intentionally avoided.

### Manual verification plan

| # | Scenario | Expect |
| --- | --- | --- |
| 1 | Own 50 ml, list 30, start split 20 | Split OK; further list/split blocked at 0 remaining |
| 2 | Own 50, active split reserves 40, try destash 20 | Server **rejects**; UI max ≤ 10 |
| 3 | Bottle amount `"full"` or empty owned, try destash > 0 | **Reject** with clear error (not silent allow) |
| 4 | Multiple destash rows; edit one upward past pool | Reject |
| 5 | Pause → resume within budget | Resume OK; listings panel + DestashManager stay consistent |
| 6 | Pause → resume when pool exhausted by another listing/split | Reject; optimistic UI rolls back |
| 7 | Lower bottle amount below listed+reserved | Reject (Stage 4) |
| 8 | Flag `DECANT_SPLITS_ENABLED=false` | Split APIs 404; destash still works |
| 9 | CSRF / unauthenticated POST | 403 / 401 unchanged |
| 10 | Photo required publish | Existing `errorCode` path still maps in UI |

Also re-run [smoke-test-decant-splits.md](./smoke-test-decant-splits.md) after Stage 1–2.

---

## Decisions needing explicit review

| ID | Question | Status / note |
| --- | --- | --- |
| **D1** | What is “unknown owned”? | **Chosen:** any unknown owned row → `mayAllocate: false`; `ownership: "none"` when known sum ≤ 0. |
| **D2** | Legacy `"full"` / non-numeric `amount` rows | **Chosen:** classify unknown; block new **positive** allocation until user edits to a number. No migration/backfill. |
| **D3** | Bottle delete with sibling destashes / splits | **Chosen (1b):** block when remaining commitments would exceed known owned, or bottle is `sourceUserPerfumeId` of an active (reserving) split. |
| **D4** | First listing writes `available` onto the bottle row vs always `create-decant` | Still open — preserve current behavior until product says otherwise. |
| **D5** | Should destash create require condition/format? | Still open — leave optional unless asked. |
| **D6** | Pause storage via Prisma vs raw SQL | Still open — reliability-neutral. |
| **D7** | Shared module location | **Chosen:** extend `lib/decant-split-ml.ts`. |
| **D8** | Completed split: ledger-only vs also reduce `UserPerfume.amount` | **Interim chosen:** ledger via `consumedCompletedSplitMl` (no amount rewrite). Optional bottle write-down later. |

Stages 1a–5 are implemented. Remaining work is operator smoke, optional atoms, and product decisions D4–D6 / D8.

---

## Verification closeout (2026-10-20)

### Completed fixes (this reliability phase)

| Area | What shipped |
| --- | --- |
| Shared budget | One pourable formula: owned − listed − reserved − consumed-completed; unknown owned never unlimited |
| Server writers | Destash create/update, split create, bottle reduce/remove under pool lock + structured `errorCode` |
| Destash form | Authoritative budget UI; no 100 ml fallback; Pause action; photo hint; submit revalidate; draft retention |
| Destash mutations | Clearable price/condition/format; clean create; edit snapshot; pause/resume omit images; pause-all partial failure |
| Split wizard | Budget load/error/retry; slot/volume validation; live sum; final summary; duplicate-submit lock; conflict refresh |
| Tests / polish | Focused unit coverage; route test FormData Content-Type; `setErrorRef` moved off render path |

### Exercise matrix (requested 1–10)

| # | Exercise | Evidence | Kind |
| --- | --- | --- | --- |
| 1 | Add existing fragrance to inventory | Not exercised in browser (signed-out). Code path unchanged (`action=add`). | **Blocked** (auth) |
| 2 | Manual-entry missing fragrance | Not exercised in browser. | **Blocked** (auth) |
| 3 | First + additional destashes | Client budget + payload tests; server `createDestashEntry` / pool math unit-covered. | **Mock/unit** |
| 4 | Edit/clear price, condition, format | `lib/destash-form-payload.test.ts` (empty fields present → clear). | **Mock/unit** |
| 5 | Pause/resume/remove; Pause all partial failure | Payload omission + manager logic; no live multi-listing UI run. | **Mock/unit** (UI **blocked**) |
| 6 | Split reserves → conflicting destash | `canAcceptAllocationMl` / pooled budget unit tests. | **Mock/unit** |
| 7 | Destash reserves → conflicting split | Same pool helpers + wizard exceeds-available tests. | **Mock/unit** |
| 8 | Concurrent allocation | Integration file present; **skipped** without `ALLOCATION_CONCURRENCY_TEST=1`. | **Not run** (gated DB) |
| 9 | Inventory reduce/remove with allocations | `commitmentsExceedOwned` unit tests. | **Mock/unit** |
| 10 | Split completion blocks re-list of poured ml | `consumedCompletedSplitMl` unit tests in `lib/decant-split-ml.test.ts`. | **Mock/unit** |

**Cross-cuts:** CSRF/auth still on route (mocked requireCSRF in unit tests — **not** a live 403 probe). Feature flag gating preserved on split APIs. Alerts still fire only after successful destash commit (code inspection). Photo `errorCode` mapping via `resolveListingApiError` (unit/path). Legacy `"full"` → unknown ownership unit-covered.

### Tooling evidence

| Check | Result | Notes |
| --- | --- | --- |
| `npx vitest run` (focused destash/split suite) | **72 passed, 1 skipped** | Skipped = DB concurrency gate |
| `npm run typecheck` | **Passed** | Standalone `tsc` |
| `npm run i18n:diff` | **In sync** | es/fr/it |
| ESLint (touched destash/split files) | **Passed** after ref fix | Prior warning: ref write during render |
| `npm run build` | **Did not complete** | Prisma generate **EPERM** while `next dev` locked query engine; retry `next build` compiled (~16.7m) then stalled on “Running TypeScript…”; processes **stopped** on request |
| Browser 1440 / 820 / 390 / 320 | **Hero unchanged** on `/` | Brand + tagline + search present at each width |
| Signed-in My Scents / `#destash` forms | **Blocked** | Session showed Sign In / Join free; `/profile/my-scents` → not-found without `{userSlug}` |

Do **not** treat skipped concurrency, killed production build, or signed-out UI as passed.

### Remaining blockers

1. **Authorized browser smoke** — exercises 1–2, 5 UI, pause-all partial failure, photo upload, and live alert delivery need a signed-in session.
2. **DB concurrency proof** — run with `ALLOCATION_CONCURRENCY_TEST=1` on an isolated database (not run this session).
3. **Production build** — re-run `npm run build` with **no** concurrent `next dev` (avoid Prisma DLL lock / resource contention).
4. **Operator smoke docs** — Stage 2/5 manual checkboxes; extend `smoke-test-decant-splits.md`.
5. **Open product decisions** — D4 (first listing on bottle row), D5 (require condition/format), D6 (pause Prisma vs SQL), D8 (optional bottle write-down on split complete).

### Short page-redesign backlog (observed friction only — do not implement here)

1. Destash + split budget/status copy is dense; a calmer single-scent layout could separate inventory vs listing vs split without changing contracts.
2. Split wizard still uses native inputs/selects; atoms alignment is UX polish, not reliability.
3. Multi-bottle source hints remain unused i18n (`sourceBottleLabel`, etc.) while caps stay perfume-pooled — clarify or remove in a redesign pass.
4. First-listing-writes-bottle-row (D4) confuses “create additional destash” mental model — product/UX decision before any layout work.
5. Mobile `#destash` create/edit needs signed-in pass for focus order, error focus, and photo picker comfort (not verified live).

---

## Related docs

- [user-guide-decants.md](./user-guide-decants.md) — pourable ml product language
- [smoke-test-decant-splits.md](./smoke-test-decant-splits.md) — split manual QA
- [architecture.md](./architecture.md) — `user-inventory.server` layer
- [quality.md](./quality.md) — test gates
- Hub: [README.md](./README.md)
