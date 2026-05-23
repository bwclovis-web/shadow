# Translation Reference — perfumer's hollow

## Locales

| Code | Language | File |
|------|----------|------|
| `en` | English (source) | `messages/en.json` |
| `es` | Spanish | `messages/es.json` |
| `fr` | French | `messages/fr.json` |
| `it` | Italian | `messages/it.json` |

Configured in `i18n/request.ts`. English is always the source of truth.

## Brand and product names

Keep these **exactly as written** (do not translate):

| Term | Rule |
|------|------|
| `perfumer's hollow` | Always lowercase, always English, including in page titles |
| `My Scents` | Keep English in all locales (existing convention) |

Translate these **consistently** using established equivalents:

| English | Spanish | French | Italian |
|---------|---------|--------|---------|
| The Archive | El Archivo | L'Archive | L'Archivio |
| The Exchange | El Intercambio | L'Échange | L'Exchange |
| trader / traders | trader / traders | trader / traders | trader / traders |

When unsure, grep existing locale files for the same English term and reuse the established translation.

## Placeholders — must preserve exactly

next-intl uses several placeholder styles. **Never rename, remove, or reorder them.**

| Style | Example | Notes |
|-------|---------|-------|
| Simple | `{name}`, `{count}` | Single braces |
| Legacy/double | `{{itemName}}`, `{{error}}` | Double braces (older keys in `common`) |
| ICU plural | `{count, plural, =0 {No items} one {# item} other {# items}}` | Keep ICU structure; translate only the inner text |
| ICU select | `{gender, select, male {He} female {She} other {They}}` | Same rule |

Also preserve literal punctuation patterns used in English language (em dashes, ellipses).

## Tone and style

- **UI strings**: Short, imperative or label-style. Match the brevity of the English.
- **Marketing / editorial**: Warm, collector-focused tone. Spanish uses formal *usted* forms where existing copy does.
- **Meta titles**: `{Page title} - perfumer's hollow` — translate the page title, keep the suffix.
- **Accessibility (`ariaLabel`, `aria-*`)**: Translate fully; keep placeholders intact.

## JSON structure rules

1. Mirror the nested key structure of `en.json` exactly.
2. Do not rename or remove keys in locale files unless removing from `en.json` too.
3. Keep valid JSON (trailing commas are invalid).
4. Prefer matching key order in `en.json` when adding new sections.

## Common pitfalls

- Translating `{count}` inside ICU blocks but accidentally changing the variable name
- Translating "perfumer's hollow" or capitalizing it
- Inconsistent section names (e.g. "El Archivo" vs "el archivo" — follow existing keys in that locale)
- Forgetting to sync all three targets (`es`, `fr`, `it`) after an `en.json` edit
