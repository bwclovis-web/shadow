# Journal growth for SEO (Phase 2)

Ranking needs **published** Sanity articles linked into the catalog — not more CMS plumbing. The app already indexes `/journal/{slug}` via [`app/sitemap.ts`](../app/sitemap.ts) and per-post metadata in [`app/journal/[slug]/page.tsx`](../app/journal/[slug]/page.tsx).

## Editorial checklist (per post)

1. **Unique title + meta description** in Sanity (avoid duplicates across posts).
2. **Primary slug** that matches the topic (house story, notes deep-dive, indie brand intro).
3. **Internal links** in the body to at least one live:
   - `/perfume/{slug}`
   - and/or `/houses/{slug}`
4. Prefer topics that match **long-tail** coverage you actually have in the Archive (obscure indie bottles/houses), not Fragrantica head terms.
5. Publish in Sanity → confirm the post appears on `/journal` and in `/sitemap/static.xml` (via `/sitemap-index.xml`).
6. In Search Console, request indexing for the new `/journal/{slug}` URL.

## Suggested first batch (examples)

| Angle | Why it helps |
|-------|----------------|
| House intro for a catalog house you scrape well | Strengthens house + perfume entity pages |
| “Notes of X” for a distinctive material in your catalog | Captures note-adjacent long-tail |
| Behind one indie bottle with community/exchange angle | Differentiates vs encyclopedia sites |

## Out of scope here

- Writing full article copy in the repo
- Paid promotion / backlink campaigns
