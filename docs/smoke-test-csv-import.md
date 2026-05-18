# Smoke test — CSV Import (IMP-251 + IMP-252 + IMP-253 + IMP-254)

Manual verification steps for the CSV import entry point on My Scents.
Run after each milestone (IMP-251 parse layer, IMP-252 matching, IMP-253 commit, IMP-254 catalog submit).

**IMP-254 status:** Submit unmatched rows to catalog is implemented. Run sections **39–45** below in addition to IMP-253 steps (sections 23–38).

**Scope of this guide:**

| Milestone | Covered here |
|-----------|----------------|
| IMP-251 | Parse, preview table, warnings, limits |
| IMP-252 | Auto catalog match, green/yellow/red buckets, match summary, Next → session draft |
| IMP-253 | Review screen (3 buckets), batch commit, `UserPerfume` writes |
| IMP-254 | Submit no-match rows to catalog, linked house pending, admin approve → `UserPerfume` |

**Column contract:** `perfumeName`, `house`, `amount`, `condition`, `tradePreference`
(maps to `UserPerfume.amount`, not legacy `mlRemaining`). Imports are
**inventory-only** (not live Exchange listings) until the user lists them.

**No DB writes** in IMP-251 or IMP-252 — matching is read-only against the catalog.
IMP-253 writes inventory via `POST /api/csv-import/commit` when the user clicks **Import N rows**.

---

## Prerequisites

1. Dev server running (`npm run dev`).
2. Signed in as any non-admin test account.
3. Have at least one perfume already in My Scents (for duplicate-in-collection tests in IMP-253).
4. **For IMP-252:** Know at least three perfumes in your local catalog — one you can match exactly (name + house), one close typo, and one name that does not exist. Examples below assume **Aventus / Creed**, **Black Orchid / Tom Ford** exist; adjust names to match your DB.
5. A spreadsheet app (Excel, LibreOffice, Google Sheets) or a plain text editor to create test CSVs.

---

## Test CSVs to prepare

Save each as a `.csv` file before starting.

### A — Happy path (comma-delimited, UTF-8)

Use perfume/house pairs that **exist in your catalog** so IMP-252 can show green matches.

```csv
perfumeName,house,amount,condition,tradePreference
Aventus,Creed,50ml,mint,trade
Black Orchid,Tom Ford,full,lightlyUsed,both
```

(Add a third row if you have another known catalog entry.)

### B — Excel BOM (UTF-8 with BOM)

Same content as A but saved from Excel as "CSV UTF-8 (with BOM)".
Many text editors let you add BOM manually; alternatively use:
```bash
printf '\xEF\xBB\xBF' > b_bom.csv && cat a_happy.csv >> b_bom.csv
```

### C — Semicolon-delimited (Excel non-US locale)

```csv
perfumeName;house;amount;condition;tradePreference
Aventus;Creed;50ml;mint;trade
```

### D — Enum warnings

```csv
perfumeName,house,amount,condition,tradePreference
Rose Oudh,Amouage,50,used,swap
Tobacco Vanille,Tom Ford,,N/A,sell
```

- `used` is not a valid `ListingCondition` → should warn, default to no condition
- `swap` maps to `trade` (alias) → accepted with no warning
  (or warn if alias policy changed to strict)
- `sell` maps to `cash` (alias)
- `N/A` condition → warn, no condition
- Empty amount → normalised to `"full"`, no warning

### E — Amount formats

```csv
perfumeName,house,amount,condition,tradePreference
P1,House A,50ml,,
P2,House B,50 ml,,
P3,House C,50mL,,
P4,House D,full,,
P5,House E,Full,,
P6,House F,FULL,,
P7,House G,abc,,
P8,House H,,,
```

### F — mlRemaining column (legacy column name)

```csv
perfumeName,house,mlRemaining,condition,tradePreference
Aventus,Creed,50,mint,trade
```

### G — Duplicate rows within CSV

```csv
perfumeName,house,amount,condition,tradePreference
Aventus,Creed,50ml,mint,trade
Aventus,Creed,30ml,lightlyUsed,cash
```

### H — Missing required header

```csv
name,brand,ml,cond,pref
Aventus,Creed,50,mint,trade
```

### I — Exceeds row cap

Generate a CSV with 201 data rows (any perfume names). A small shell snippet:

```bash
{ echo "perfumeName,house,amount,condition,tradePreference"; \
  for i in $(seq 1 201); do echo "Perfume $i,House,full,,"; done; } > i_201rows.csv
```

### J — File too large (> 500 KB)

```bash
python3 -c "
import random, string
with open('j_large.csv', 'w') as f:
    f.write('perfumeName,house,amount,condition,tradePreference\n')
    for i in range(5000):
        name = ''.join(random.choices(string.ascii_letters, k=80))
        f.write(f'{name},House,full,,\n')
"
```

### K — Empty file

A file with only the header row and no data rows:

```csv
perfumeName,house,amount,condition,tradePreference
```

### L — IMP-252: Confident + uncertain + no match (mixed)

Replace names with catalog entries you control. Example:

```csv
perfumeName,house,amount,condition,tradePreference
Aventus,Creed,50ml,mint,trade
Aventis,Creed,30ml,lightlyUsed,cash
Totally Fake Perfume XYZ,Unknown House,full,,
```

- Row 1: exact name + house → **green (Matched)**
- Row 2: typo (`Aventis` vs `Aventus`) → **amber (Uncertain)** if similarity is in range; otherwise red
- Row 3: nonsense → **red (No match)**

### M — IMP-252: Wrong house (scoped out)

If `Black Orchid` exists under Tom Ford only:

```csv
perfumeName,house,amount,condition,tradePreference
Black Orchid,Creed,full,,
```

**Expected:** **No match** (house filter excludes Tom Ford catalog entry).

### N — IMP-252: No house column value (broader name search)

```csv
perfumeName,house,amount,condition,tradePreference
Black Orchid,,full,,
```

**Expected:** May match via name-only catalog search if `Black Orchid` exists (bucket depends on score).

---

## IMP-251 — Parse and preview

### 1. Entry point visible

**Steps:**
1. Navigate to `/{yourSlug}/profile/my-scents`.
2. Locate the title area at the top of the scents list.

**Expected:** An **Import CSV** button is visible alongside **Bulk add**.

### 1b. Inventory notice

**Steps:**
1. Open the Import CSV panel.

**Expected:** Italic notice under the description:
*"Imported rows are saved to your inventory only—not live listings. List them on
the Exchange when you are ready to trade."*

---

### 2. Template download

**Steps:**
1. Open the Import CSV panel.
2. Click "Download template".

**Expected:**
- Browser downloads a `.csv` file.
- Opening it shows exactly the header row:
  `perfumeName,house,amount,condition,tradePreference`
- One example row is present.
- No BOM or stray characters in the first cell.

---

### 3. Happy path (CSV A)

**Steps:**
1. Upload CSV A (catalog-known perfumes).

**Expected:**
- Panel shows a preview table with columns: `#`, `perfumeName`, `house`,
  `amount`, `condition`, `tradePreference`, **`Match`**, `warnings`.
- Row values match the CSV: `50` (not `50ml`), `mint`, `trade` etc.
- No parse warnings on valid rows.
- Summary bar: `N rows ready · 0 have warnings` (or warnings count if any).
- Brief **"Matching against catalog…"** status, then match cells populate.
- Match summary: `X matched · Y uncertain · Z not found`.
- **"Next: Review matches →"** enabled after matching completes (no header/file errors).

---

### 4. BOM handling (CSV B)

**Steps:**
1. Upload CSV B (UTF-8 with BOM).

**Expected:** Identical result to test 3 — BOM stripped, matching runs, no extra character in headers or first cell.

---

### 5. Semicolon-delimited (CSV C)

**Steps:**
1. Upload CSV C.

**Expected:**
- Parse succeeds — 1 row in preview.
- A non-blocking notice: "Detected semicolon-delimited file — parsed successfully."
- Matching runs and **Match** column fills in.

---

### 6. Enum warnings (CSV D)

**Steps:**
1. Upload CSV D.

**Expected:**
- Both rows appear in the preview (rows are not dropped).
- Row 1 (`used` condition): warning icon; condition cell shows empty or "—".
- Row 2 (`N/A` condition): warning; condition cell empty.
- Row 2 (empty amount): amount shows `full`, no warning.
- **Match** column still populates after auto-match (independent of parse warnings).
- Summary: `2 rows ready · ≥ 1 have warnings`.

---

### 7. Amount normalisation (CSV E)

**Steps:**
1. Upload CSV E.

**Expected:**

| Row | Amount input | Expected display | Warning? |
|-----|---|---|---|
| P1 | `50ml` | `50` | No |
| P2 | `50 ml` | `50` | No |
| P3 | `50mL` | `50` | No |
| P4 | `full` | `full` | No |
| P5 | `Full` | `full` | No |
| P6 | `FULL` | `full` | No |
| P7 | `abc` | `full` | Yes — invalid amount |
| P8 | (empty) | `full` | No |

Matching still runs for all rows after parse.

---

### 8. mlRemaining column notice (CSV F)

**Steps:**
1. Upload CSV F.

**Expected:**
- A notice at the top (non-blocking) about `mlRemaining` / rename to `amount`.
- The row is still shown in the preview.
- The `amount` cell is empty / `full` (the `mlRemaining` data is **not** silently mapped).
- Matching runs; if `Aventus` + `Creed` exist, **Match** shows green.

---

### 9. Duplicate rows within CSV (CSV G)

**Steps:**
1. Upload CSV G (two rows with the same `perfumeName` + `house`).

**Expected:**
- Both rows appear.
- Row 2 shows a parse warning: duplicate row reference to row 1.
- Both rows can still receive **Match** results after auto-match.

---

### 10. Missing required header (CSV H)

**Steps:**
1. Upload CSV H (headers are `name`, `brand`, `ml`, `cond`, `pref`).

**Expected:**
- A blocking header error strip (red).
- Error names missing columns, e.g. `perfumeName`, `house`.
- No row preview table (or no data rows).
- **No** matching request (no "Matching against catalog…" for invalid parse).
- **"Next: Review matches →"** disabled.

---

### 11. Row cap (CSV I — 201 rows)

**Steps:**
1. Upload CSV I.

**Expected:**
- Preview shows exactly **200** rows.
- Truncation notice at the top.
- Matching runs for the 200 shown rows (may take a few seconds).
- No crash or hang.

---

### 12. File too large (CSV J — > 500 KB)

**Steps:**
1. Attempt to upload CSV J.

**Expected:**
- File rejected immediately: `"File is too large (max 500 KB)"` or similar.
- No spinner, parse, or match attempt.

---

### 13. Empty file (CSV K)

**Steps:**
1. Upload CSV K (header only, no data rows).

**Expected:**
- No row preview table (or empty state message).
- **"Next: Review matches →"** disabled.
- No match API call.

---

### 14. Panel close / reset

**Steps:**
1. Upload CSV A — verify rows and match badges shown.
2. Close the Import CSV panel (× or toggle).
3. Reopen the panel.

**Expected:** Panel is empty — no stale rows or match results from the previous upload.

---

## IMP-252 — Catalog fuzzy match

### 15. Auto-match after successful parse

**Steps:**
1. Upload CSV A.
2. Watch the panel immediately after parse completes.

**Expected:**
- Status text **"Matching against catalog…"** appears (`data-testid="csv-import-matching"`).
- No manual "Match" button required — match runs automatically once.
- **Match** column updates from `—` / "Matching…" to badges when done.
- Network tab: one `POST /api/csv-import/match` with JSON body `{ rows: [...] }` (includes `_csrf` or `x-csrf-token` header).

---

### 16. Match column badges (CSV L)

**Steps:**
1. Upload CSV L (adjust names to your catalog).

**Expected:**

| Bucket | Badge label (en) | Colour cue |
|--------|------------------|------------|
| Confident | Matched | Green border/background |
| Uncertain | Uncertain | Amber border/background |
| No match | No match | Red border/background |

- Confident/uncertain rows show catalog **perfume name · house** under the badge.
- Uncertain row may show **"Also: …"** with an alternative candidate name.

---

### 17. Match summary bar

**Steps:**
1. After CSV L finishes matching, read the line below the parse summary.

**Expected:**
- Text like: `1 matched · 1 uncertain · 1 not found` (counts match your CSV L results).
- Element: `data-testid="csv-import-match-summary"`.

---

### 18. Wrong house → no match (CSV M)

**Steps:**
1. Upload CSV M (correct perfume name, wrong house).

**Expected:**
- **Match** cell: red **No match** (house scopes candidates; Tom Ford bottle not found under Creed).

---

### 19. Empty house uses name search (CSV N)

**Steps:**
1. Upload CSV N.

**Expected:**
- If perfume exists in catalog, **Match** may be green or amber (not blocked by missing house).
- If multiple houses share a similar name, bucket may be **Uncertain** — note for IMP-253 review.

---

### 20. Match API failure + retry

**Steps:**
1. Upload CSV A.
2. In DevTools → Network, block `csv-import/match` (or go offline) before upload, then upload; or block and click **Retry matching** if error UI appears.

**Expected:**
- Error strip: **"Could not match rows against catalog. Try again."**
- **Retry matching** button visible.
- **"Next: Review matches →"** stays disabled until a successful match.
- After unblocking, **Retry matching** succeeds and badges appear.

---

### 21. "Next: Review matches" saves session draft (IMP-252 stub)

**Steps:**
1. Upload CSV A; wait for matching to finish.
2. Click **"Next: Review matches →"**.
3. In DevTools → Application → Session Storage, inspect key `shadow:csv-import-match-draft`.

**Expected:**
- Button enabled only when parse is valid **and** match completed (not while matching).
- Success message: match results saved for review (wording from `myScents.csvImport.reviewDraftSaved`).
- Session storage contains JSON with `parseResult` and `matchResult` arrays.
- **No** `POST /api/user-perfumes` — still no inventory writes (IMP-253).
- Full review UI navigation is IMP-253; this step only persists the draft.

---

### 22. No database writes (regression)

**Steps:**
1. Upload and match CSV A.
2. Filter Network for `user-perfumes` and watch Prisma-related activity.

**Expected:**
- Only `POST /api/csv-import/match` (read/catalog lookup).
- No create/update of `UserPerfume` or `PendingSubmission` from this flow.

---

## IMP-253 — Review screen and commit

### 23. Next opens review screen (all three bucket sections)

**Steps:**
1. Upload CSV A (or CSV L with mixed buckets); wait for matching.
2. Click **Next: Review matches →**.

**Expected:**
- Panel shows **Review matches** title (not upload title).
- **Confirmed matches** section lists green-bucket rows with checkboxes (all checked by default).
- **Uncertain matches** section lists yellow-bucket rows with radio options + **None of these**.
- **No match found** section lists red-bucket rows with **Skip** label.
- `data-testid="csv-import-review-screen"` present.

---

### 24. Confident: confirm all / individual deselect

**Steps:**
1. On review screen with at least one confident row.
2. Uncheck **Confirm all** — all confident checkboxes clear.
3. Re-check **Confirm all** — all confident checkboxes selected.
4. Uncheck one row only.

**Expected:**
- **Import N rows** count decreases when rows are unchecked.
- `data-testid="csv-import-review-confirm-all"` toggles all confident rows.

---

### 25. Uncertain: pick alternative enables import

**Steps:**
1. On a yellow-bucket row, select a catalog radio option (not **None of these**).
2. Watch **Import N rows** count.

**Expected:**
- Count increases by 1 when a match is selected.
- Selecting **None of these** excludes the row from import count.

---

### 26. No-match rows: skipped by default, optional catalog submit

**Steps:**
1. Upload CSV with at least one red-bucket row.
2. On review screen, note the primary button count without selecting anything on red rows.
3. Check one red row **Submit to catalog** and confirm the count updates.

**Expected:**
- Red rows do not contribute to import count unless checked for catalog submit.
- No-match section shows **Submit to catalog** checkboxes and hint text (not “coming soon”).
- Selecting a red row increases the catalog submit portion of the combined CTA label.

---

### 27. Import commits and shows done state

**Steps:**
1. Select at least one row across confident/uncertain sections.
2. Click **Import N rows** (`data-testid="csv-import-commit"`).
3. Wait for completion.

**Expected:**
- One `POST /api/csv-import/commit` with JSON `{ rows: [...] }` (CSRF header/body).
- Done step shows committed/skipped counts (`data-testid="csv-import-done"`).
- My Scents collection refreshes (new bottles visible after **Close**).
- Session key `shadow:csv-import-match-draft` removed from sessionStorage.

---

### 28. Duplicate in collection skipped

**Prerequisites:** CSV A includes a perfume already in your My Scents collection.

**Steps:**
1. Complete import including that perfume.

**Expected:**
- Done message shows `skipped` ≥ 1.
- Duplicate notice: rows already in collection were skipped.
- No second `UserPerfume` for the same `perfumeId` (verify in UI or DB).

---

### 29. Missing session draft

**Steps:**
1. Reach review screen, then in DevTools delete `shadow:csv-import-match-draft`.
2. Refresh page or navigate away and back (if panel remounts on review step, use **Back** then **Next** after clearing storage before Next).

**Alternative:** Open review with empty sessionStorage (manual test via clearing before Next).

**Expected:**
- Error: match results not found.
- **← Back** returns to upload step.

---

### 30. condition and tradePreference persisted

**Steps:**
1. Import CSV A with `condition` and `tradePreference` set (e.g. `mint`, `trade`).
2. Inspect created `UserPerfume` in Prisma Studio or DB.

**Expected:**
- `condition` = `mint` (or parsed value).
- `tradePreference` = `trade` (or parsed value).

---

### 31. No DB writes until Import (regression)

**Steps:**
1. Upload and match; click **Next** but do **not** click Import.
2. Filter Network for `csv-import/commit` and `user-perfumes`.

**Expected:**
- No `POST /api/csv-import/commit` until **Import N rows**.
- No `UserPerfume` creates from CSV flow before commit.

---

## IMP-253 hardening (Phase 2 — run after risk mitigations ship)

### 32. Commit rejects invalid perfumeId for row

**Prerequisites:** DevTools open on Network tab.

**Steps:**
1. Complete match + review with at least one row selected for import.
2. Before clicking Import, in DevTools → Application → sessionStorage, note `shadow:csv-import-match-draft`.
3. Intercept or replay `POST /api/csv-import/commit` with a `perfumeId` that was **not** offered for that row (e.g. random cuid).

**Expected:**
- API returns 400 with an error indicating the perfume is not allowed for that row (or row lands in `errors[]` with a validation message).
- No `UserPerfume` created for the forged id.

---

### 33. Partial commit shows per-row errors on done step

**Steps:**
1. Force a partial failure if possible (e.g. one valid row + one invalid `perfumeId` in crafted request), or use a row that errors in `addUserPerfume`.
2. Complete import.

**Expected:**
- Done step (`data-testid="csv-import-done"`) shows committed/skipped counts.
- When `errors` &gt; 0, a list (up to ~10) shows row number and error message.

---

### 34. Stale session draft warning

**Steps:**
1. Upload + match + **Next** to review.
2. In sessionStorage, set `savedAt` on the draft JSON to more than 24 hours ago (or wait; manual test uses edited timestamp).
3. Reload review step (Back → Next, or refresh if panel restores review).

**Expected:**
- Non-blocking banner: match results may be stale; user can still import or go back to re-match.
- `data-testid="csv-import-review-stale-draft"` present when stale.

---

## IMP-254 — Submit unmatched rows to catalog

### 39. No-match section: submit to catalog checkboxes

**Prerequisites:** CSV with at least one red-bucket row (unknown perfume name, house may exist or not).

**Steps:**
1. Complete upload + match → **Next: Review matches**.
2. Scroll to the no-match section (`data-testid="csv-import-review-no-match"`).

**Expected:**
- Rows show checkboxes **Submit to catalog** (not “coming soon”).
- **Submit all to catalog** toggles eligible rows.
- Rows missing perfume name or house have disabled checkboxes + reason text.

---

### 40. Combined finish: import + catalog submit

**Steps:**
1. Select at least one confident/uncertain row for import AND one no-match row for catalog submit.
2. Click the primary button (combined label when both counts &gt; 0).

**Expected:**
- `POST /api/csv-import/commit` for matched rows.
- `POST /api/csv-import/submit-catalog` for selected no-match rows.
- Done step shows import counts and catalog submission count (`review.doneCatalog`).

---

### 41. Known house: perfume pending only

**Prerequisites:** No-match row where **house exists** in catalog but perfume does not.

**Steps:**
1. Submit row to catalog.
2. As admin, open `/admin/pending-submission`.

**Expected:**
- One **perfume** pending submission with **CSV import** badge.
- **Collection intent** block shows amount / condition / trade preference.
- No separate house submission for that row.

---

### 42. Unknown house: chained house + perfume pending

**Prerequisites:** No-match row where **house does not exist** in catalog.

**Steps:**
1. Submit row to catalog.
2. As admin, open `/admin/pending-submission`.

**Expected:**
- One **perfume_house** pending submission (auto-created).
- One **perfume** pending submission linked to the house submission.
- Perfume card shows warning: approve house first; **Approve** disabled until house is approved.

---

### 43. Approve chain → submitter collection updated

**Steps:**
1. Approve the linked **perfume house** submission.
2. Approve the **perfume** submission.

**Expected:**
- Catalog gains house + perfume.
- Submitter’s My Scents shows new `UserPerfume` with CSV amount/condition/trade preference.
- Duplicate approve does not create a second `UserPerfume` if already owned.

---

### 44. Reject linked house blocks perfume approve

**Steps:**
1. Reject the auto-created house submission.
2. Attempt to approve the linked perfume submission.

**Expected:**
- Server error instructing admin to reject the perfume submission too.

---

### 45. Rate limits (optional)

**Steps:**
1. Rapidly submit many catalog rows (&gt;5/min) or exceed 20 pending submissions/hour.

**Expected:**
- API returns rate-limit response (same family as contact pending submissions).

---

## What these tests do NOT cover

| Concern | Covered by |
|---|---|
| Fragrantica URL import | IMP-255 smoke test |
| Exchange listing after import | Manual: list bottle on Exchange |
| Rate limit (10 match requests / minute) | Optional: rapid re-upload stress test |

---

## Checklist

Copy and tick when running a full pass (IMP-251–254).

### IMP-251 — Parse

- [ ] 1. Entry point visible
- [ ] 1b. Inventory notice
- [ ] 2. Template download
- [ ] 3. Happy path (CSV A) + parse columns
- [ ] 4. BOM handling (CSV B)
- [ ] 5. Semicolon-delimited (CSV C)
- [ ] 6. Enum warnings (CSV D)
- [ ] 7. Amount normalisation (CSV E)
- [ ] 8. mlRemaining notice (CSV F)
- [ ] 9. Duplicate rows within CSV (CSV G)
- [ ] 10. Missing required header (CSV H)
- [ ] 11. Row cap 200 (CSV I)
- [ ] 12. File too large (CSV J)
- [ ] 13. Empty file (CSV K)
- [ ] 14. Panel close / reset

### IMP-252 — Match

- [ ] 15. Auto-match after parse + `POST /api/csv-import/match`
- [ ] 16. Green / amber / red badges (CSV L)
- [ ] 17. Match summary counts
- [ ] 18. Wrong house → no match (CSV M)
- [ ] 19. Empty house name search (CSV N)
- [ ] 20. Match error + retry
- [ ] 21. Next saves `shadow:csv-import-match-draft` in sessionStorage
- [ ] 22. No `UserPerfume` / admin submission writes (before IMP-253 commit)

### IMP-253 — Review and commit

- [ ] 23. Next opens review screen (3 sections)
- [ ] 24. Confident confirm all / deselect
- [ ] 25. Uncertain pick alternative
- [ ] 26. No-match skipped by default; catalog submit opt-in
- [ ] 27. Import commits + done state + collection refresh
- [ ] 28. Duplicate in collection skipped
- [ ] 29. Missing session draft error + Back
- [ ] 30. condition + tradePreference persisted
- [ ] 31. No DB writes until Import clicked

### IMP-253 — Hardening (optional, after Phase 2 code)

- [ ] 32. Commit rejects invalid perfumeId for row
- [ ] 33. Partial commit shows per-row errors on done step
- [ ] 34. Stale session draft warning

### IMP-254 — Submit unmatched rows to catalog

- [ ] 39. No-match section: submit to catalog checkboxes
- [ ] 40. Combined finish: import + catalog submit
- [ ] 41. Known house: perfume pending only
- [ ] 42. Unknown house: chained house + perfume pending
- [ ] 43. Approve chain → submitter collection updated
- [ ] 44. Reject linked house blocks perfume approve
- [ ] 45. Rate limits (optional)

---

## Related files

| File | Purpose |
|------|---------|
| `lib/csv-import-user.ts` | Parse library (IMP-251) |
| `lib/csv-import-match.ts` | Match types, thresholds, scoring (IMP-252) |
| `lib/csv-import-match.test.ts` | Unit tests for scoring |
| `app/api/csv-import/match/route.ts` | Batch match API (IMP-252) |
| `app/api/csv-import/commit/route.ts` | Batch commit API (IMP-253) |
| `app/api/csv-import/submit-catalog/route.ts` | Catalog submit API (IMP-254) |
| `lib/csv-import-commit.ts` | Commit request validation (IMP-253) |
| `lib/csv-import-pending-submission.ts` | Catalog submission payload + validation (IMP-254) |
| `hooks/useCsvImportCommit.ts` | Review decisions + commit + catalog submit (IMP-253/254) |
| `components/.../CsvImportReviewScreen.tsx` | 3-bucket review UI + catalog submit (IMP-253/254) |
| `models/pending-submission.server.ts` | `approvePendingSubmission` + linked house gating (IMP-254) |
| `app/admin/pending-submission/PendingSubmissionClient.tsx` | Admin CSV import badge + inventory intent (IMP-254) |
| `hooks/useCsvImport.ts` | Parse + match state, session draft |
| `components/Containers/MyScents/CsvImport/CsvImportPanel.tsx` | UI |
| `docs/imp-251-csv-import-plan.md` | Full plan, risk register |
| `docs/improvements-v2.md` | Wave B1 backlog (IMP-250–254) |
