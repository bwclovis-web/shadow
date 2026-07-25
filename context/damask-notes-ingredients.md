# Damask Haus notes vs Ingredients

## 2026-07-25 — INCI block bled into flat notes

**Symptom:** Scrapes showed notes like `fried dough. ingredients: alcohol (denat.)`, `(parfum)`, `water (aqua)`, plus EU allergens (`linalool`, `geraniol`, …) for products such as Berliners.

**Cause:** Damask PDPs put a narrative `Notes:` sentence, then an `Ingredients:` INCI list. When PDP text is whitespace-collapsed to one line, Python `_NOTE_LABEL_TEXT_RE` captured past `Ingredients:`. `_truncate_note_list_tail` / `_NOTE_LIST_PROSE_TAIL_RE` did not cut on `Ingredients:`, and the flat `text_regex_flat` path did not run `_is_junk_note`.

**Fix (Python primary):** Stop at `ingredients?:` in label stop + prose-tail truncation; filter INCI carriers in `is_compliance_or_sourcing_note`; junk-filter flat notes. TS already truncated via `FLAT_NOTE_PROSE_BOUNDARY_RES`; added matching compliance rejects.

**Tests:** `scraper/tests/test_damask_ingredients_bleed.py`, `lib/scraper/diag_berliners.test.ts`
