# Merchant of Venice / PrestaShop discovery

## 2026-07-25 — Locale urlsets + category PDP paths

**Symptom:** Robots found `1_index_sitemap.xml` but discovery still returned 0 products.

**Cause:** Index children are locale aggregates (`1_en_0_sitemap.xml`), not `*_product_sitemap.xml`. Restrictive walk skipped them. PDPs are `/{lang}/{category}/{id}-{slug}.html`, which the first PrestaShop regex did not match.

**Fix:** Recurse locale sitemaps with `strict_locs`; broaden PDP pattern; prefer `/en/` when the same `{id}-{slug}.html` appears in multiple locales.

## 2026-07-25 — Soft-404 dead sitemap URLs

**Symptom:** Many sitemap PDPs (e.g. `/en/flames/83-…`) hard-404 / redirect to About Us; scraper still saved `The Page You Are Looking For Was Not Found`.

**Cause:** Stale PrestaShop sitemap entries (discontinued or moved). Error-name patterns only matched exact `Page not found`; About Us `og:url` was treated as a WC product permalink.

**Fix:** Broaden error H1/title detection; skip CMS soft-404 redirects; exclude `/content/` from product URL classification.
