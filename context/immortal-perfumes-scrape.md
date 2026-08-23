# Immortal Perfumes scrape

## 2026-08-23 — Literary / UI chrome in notes

**Symptom:** After blocking Squarespace `img` / `bun`, CSV still had non-materials like `wild as the moors`, `heathcliff`, `girls came`, `one-of-a-kind`, `use the drop-down`, `interactive elements`, HTML entities (`egrave`), and pronouns (`his` / `mine`).

**Cause:** Immortal PDPs use flat `Notes: a, b, and c` followed by a literary blurb on the next line. Whitespace collapse glued that blurb into the note list (`chocolate with a love as tumultuous, wild as the moors, heathcliff…`). Collection pages (`Antiques`, `Literary Lovers`, `The Scent Strip`) expose marketing copy under a `Notes:` label with no materials.

**Fix:** Truncate note lists at Immortal literary/UI boundaries (TS + Python); peel `read more below` / `with a love` tails from the last material; reject literary/UI tokens in the sanitizer; CSV import runs `sanitizeExtractedNoteCandidate` so re-importing cleans existing files.

## 2026-08-23 — Same scrape returned 0 products

**Symptom:** Immortal Perfumes (`https://www.immortalperfumes.com/perfumes`) returned 63 products three times, then two immediate reruns completed in ~4 minutes with `discoveredUrls: []`.

**Cause:** Squarespace `sitemap.xml` returns **406** when `Accept` is HTML-only (`text/html,application/xhtml+xml`). HTTP discovery then found nothing. Fallback collection crawl used Shopify `a[href*='/products/']`, which does not match Squarespace PDPs (`/perfumes/p/{slug}`), and a selector timeout returned before other fallbacks ran.

**Fix:** Broader HTTP `Accept` + 406 retry; treat `/{collection}/p/{slug}` as product URLs; do not return early on collection-selector timeout.

Jobs: `cmt61apbz001ipyxwu18vr9sn` (63 ok) then `cmt62ecq30032pyxwh4pf4nbp` / `cmt62jats0038pyxwd5gtoayb` (0).
