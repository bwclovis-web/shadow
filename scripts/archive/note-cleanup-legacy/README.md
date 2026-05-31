# Deprecated note cleanup scripts

These scripts **delete or merge `PerfumeNotes` rows** and conflict with the non-destructive **NoteMaterial** alias model.

**Do not run** them on production or shared databases.

## Replacement workflow

1. `npm run notes:seed-materials` — upsert materials and aliases (additive only)
2. `npm run notes:materials:report` — read-only coverage report
3. See `lib/note-materials/` for runtime rule-based rollup used by quiz and recommendations

## Archived files

- `merge-duplicate-notes.js` — deleted duplicate note rows
- `clean-notes.js` — removed invalid notes and merged duplicates
- `clean-notes-complete.js` — orchestrated cleanup + AI
- `clean-notes-ai.py`, `extract-ambiguous-notes.js`, `apply-ai-recommendations.js`
- `setup-venv-ai.js`, `normalize-note-ai.py`
- `README-AI-EXTRACTION.md` — legacy AI cleanup docs
