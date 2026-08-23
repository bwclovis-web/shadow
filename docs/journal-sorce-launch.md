# Journal launch — Sorce

Studio-ready brief for the first editorial batch. App UI for `/journal` is featured + tag-filter ready; publish articles in the **hosted** Sanity Studio:

**https://shadow-and-sillage.sanity.studio**

(Redeploy after schema changes with `npm run sanity:deploy`.)

## Languages

Supported article languages match the site UI: **English, Español, Français, Italiano**.

- Create **one Article document per language** (Studio → Articles → language folder, or set **Language** on the document).
- Prefer the **same slug** across translations of the same story (e.g. `sorce-house-intro` for en/es/fr/it).
- `/journal` shows articles for the visitor’s locale cookie; if none exist, it falls back to English.
- Article detail (`/journal/[slug]`) loads the matching language, then English if missing.
- Featured is **per language** (one featured article per locale).

Legacy articles without a Language field are treated as English.

## Confirmed house slug

Use **`sorce`** for `houseRefs` and body links to `/houses/sorce`.

If the live house page uses a different slug, update `spotlightHouseSlug` in [`app/journal/page.tsx`](../app/journal/page.tsx) and every article’s `houseRefs` to match.

The **Featured** slot only appears when an article has **Featured** checked in Studio. If none are featured, posts show only under **Latest stories**.

## Publish order

| # | Working title | Angle | Tags | Featured |
|---|---------------|-------|------|----------|
| 1 | *Sorce: Whimsy, Gourmands, and Wearable Fate* | House intro — Charlotte studio, Caitlin Hayes, Sorcellerie → Sorce, “crave-able” indie identity | `house-spotlight`, `sorce`, `indie` | **Yes** |
| 2 | Bottle deep-dive | One well-covered Sorce perfume from the Archive — story, when to wear, Archive link | `bottle-stories`, `sorce` | No |
| 3 | *Sweet Without Apology: Reading Sorce’s Gourmand Language* | Theme across 3–5 Sorce perfumes (vanilla, fruit, marshmallow-adjacent) | `notes`, `gourmand`, `sorce` | No |
| 4 | *From the Hollow to Sorce* | Bridge: indie houses + digital collecting / trays / wear journal → `/community` | `collecting`, `sorce` | No |

Duplicate each story in es/fr/it when ready (same slug, translated title/excerpt/body).

## Per-article checklist

1. Set **Language**; unique title + excerpt for that locale; slug matches the story (shared across languages).
2. Set **Featured** only on article #1 **per language** (prefer a single featured post per locale).
3. `publishedAt` ≤ now; click **Publish**.
4. `houseRefs`: `["sorce"]`; `perfumeRefs`: real Archive perfume slugs.
5. Body links to `/houses/sorce` and at least one `/perfume/{slug}`.
6. Cover image + alt; author byline.
7. Confirm: `/journal` (switch site language), `/houses/sorce` related strip, and `/sitemap.xml`.

See also [seo-journal-growth.md](./seo-journal-growth.md).
