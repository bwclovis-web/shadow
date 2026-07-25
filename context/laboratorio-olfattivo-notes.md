# Laboratorio Olfattivo — notes after Ingredients

## 2026-07-25 — Empty notes on Alambar / Cozumel

Italian WooCommerce PDPs put the olfactory pyramid **after** the INCI block:

```
Ingredienti Ingredients: Alcohol denat., Parfum, …
Note Olfattive
Note di testa: …
Note di cuore: …
Note di fondo: …
```

### Root causes

1. Policy strip truncated at `Ingredients:` and discarded everything after (including notes).
2. Python `notes_pipeline` lacked Italian `note di testa|cuore|fondo` layer labels (TypeScript already had them).

### Fix

- `merchant_source.py` / `title-cleaning.ts`: excise INCI when a note pyramid follows; otherwise truncate at Ingredients (Damask-style).
- `notes_pipeline.py`: Italian (+ FR/ES) layer labels in text + HTML extractors.
- Regression: `scraper/tests/test_laboratorio_olfattivo_notes.py`, `lib/scraper/diag_laboratorio.test.ts`.
