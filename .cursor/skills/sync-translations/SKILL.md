---
name: sync-translations
description: >-
  Sync i18n locale files (es, fr, it) from messages/en.json after keys are
  added or updated. Detects missing keys, translates new/changed strings, and
  validates placeholders. Use when editing messages/en.json, adding useTranslations
  keys, or when the user asks to sync, translate, or update locale files.
---

# Sync Translations from en.json

English (`messages/en.json`) is the source of truth. After any add or change there, propagate to `es`, `fr`, and `it`.

## When to run

- User edited or created keys in `messages/en.json`
- User added `useTranslations("...")` keys in code but only updated English
- User asks to "sync translations", "update locale files", or "translate the new strings"

## Workflow

Copy this checklist and track progress:

```
Translation sync:
- [ ] Step 1: Detect gaps
- [ ] Step 2: Translate missing/changed keys
- [ ] Step 3: Write locale files
- [ ] Step 4: Validate
```

### Step 1: Detect gaps

Run the diff script from the repo root:

```bash
node scripts/sync-translations-diff.js
```

For machine-readable output:

```bash
node scripts/sync-translations-diff.js --json
```

Single locale:

```bash
node scripts/sync-translations-diff.js --locale es
```

Also check recent English edits when the user just changed `en.json`:

```bash
git diff messages/en.json
```

Treat as **needs translation** when:
- Key is **missing** in a locale file
- English **value changed** and the locale still has the old wording (re-translate)
- User explicitly added new keys only to `en.json`

### Step 2: Translate

For each gap, translate the English string into Spanish, French, and Italian.

Before translating, read [reference.md](reference.md) for:
- Brand names (`perfumer's hollow`, `My Scents`, The Archive / The Exchange equivalents)
- Placeholder rules (`{name}`, `{{error}}`, ICU plural/select)
- Tone conventions

**Translation rules:**

1. Preserve every placeholder character-for-character (names and ICU syntax).
2. Keep `perfumer's hollow` and `My Scents` untranslated.
3. Reuse existing translations for repeated terms — grep locale files first.
4. Match the register of nearby strings in the same namespace.
5. Translate only string leaf values; never rename JSON keys.

**ICU example** — translate inner text only:

```
en: "{count, plural, =0 {No listings} one {# listing} other {# listings}}"
es: "{count, plural, =0 {Sin anuncios activos} one {# anuncio} other {# anuncios}}"
```

### Step 3: Write locale files

**Updated English copy (keys already exist):** Add path → locale entries in `scripts/i18n-path-overlays.json`, then run `npm run i18n:sync`. The diff script only reports *missing* keys, not changed values — use `git diff messages/en.json` to spot copy updates.

**Full sync (many keys):** Add or update strings in `scripts/i18n-string-translations.json` (keyed by English source text), then run:

```bash
node scripts/sync-translations-apply.js
```

The apply script reads the diff, maps English → locale strings, and writes `messages/es.json`, `messages/fr.json`, `messages/it.json`. Path-specific fixes (e.g. placeholder corrections) go in `pathOverrides` inside `sync-translations-apply.js`.

**Small changes:** Update locale files directly, or add only the new English strings to `i18n-string-translations.json` and run apply.

For manual edits, update `messages/es.json`, `messages/fr.json`, and `messages/it.json`:

- Add missing keys in the same nested position as `en.json`
- Update changed values when English source changed
- Do **not** edit `en.json` unless the user asked for English changes
- Keep valid JSON formatting consistent with each file

When adding a new namespace block, copy the structure from `en.json` and translate all leaf strings.

### Step 4: Validate

Re-run the diff script — it must exit 0 with "In sync" for all locales:

```bash
node scripts/sync-translations-diff.js
```

Fix any **placeholder mismatches** before finishing.

Optionally verify JSON parses:

```bash
node -e "for (const l of ['en','es','fr','it']) JSON.parse(require('fs').readFileSync('messages/'+l+'.json'))"
```

## Scope control

| User change | Action |
|-------------|--------|
| Added/updated specific keys | Translate only those keys (plus any missing parents in the path) |
| "Sync all translations" | Run full diff and translate everything reported |
| Removed key from `en.json` | Remove the same key from all locale files |
| Renamed key in `en.json` | Rename in all locale files; do not leave orphan keys |

## Output to user

When done, briefly report:
- Which keys were added or updated
- Which locale files changed
- Confirmation that `sync-translations-diff.js` passes

Do not dump entire JSON files in the response unless the user asks.

## Additional resources

- Brand terms, placeholders, tone: [reference.md](reference.md)
- Locale config: `i18n/request.ts`
