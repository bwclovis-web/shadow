# Journal Improvements

Roadmap for improving the journal so it becomes a product-strength discovery surface, not just a standalone editorial section.

This document includes a recommended delivery order, success metrics, and a "what not to do first" section so it functions as an actual planning doc instead of just notes.

## Recommendation in One Sentence

Treat the journal as a cross-linking and discovery layer for perfumes, houses, and community activity before investing heavily in visual redesign or richer content blocks.

## Current State

The journal already has a solid base:

- `app/journal/page.tsx` renders a dedicated index page.
- `app/journal/[slug]/page.tsx` renders article detail pages with metadata and JSON-LD.
- `sanity/schemaTypes/article.ts` supports `tags`, `perfumeRefs`, and `houseRefs`.
- `app/perfume/[perfumeSlug]/page.tsx` and `app/houses/[houseSlug]/page.tsx` already surface related articles.
- `models/activity-feed.server.ts` and `models/scent-journey.server.ts` already use article refs for downstream product features.
- `app/sitemap.ts` already includes published journal URLs.

This means the journal is not greenfield anymore. The main opportunity is to make the existing content graph much more visible to readers and much more useful to the rest of the product.

## Product Direction

The journal should help users do three things:

1. Read a strong editorial story.
2. Discover relevant perfumes, houses, and adjacent articles.
3. Move naturally into the rest of the product instead of dead-ending at the end of a post.

That suggests a simple principle for prioritization:

- First improve discovery, internal linking, and SEO.
- Then improve editorial structure and authoring tools.
- Only after that, invest in larger visual or interactive upgrades.

## Phase 1 - Quick Wins

These are the highest-leverage improvements because they use data the app already stores and ships.

### 1. Make the article page lead somewhere

Priority: highest

Today `app/journal/[slug]/page.tsx` mostly ends after the body content. The first improvement should be turning the bottom of each article into a discovery zone.

Add:

- related articles based on shared `tags`, `perfumeRefs`, or `houseRefs`
- linked perfumes mentioned in the story
- linked houses mentioned in the story
- optional "next article" / "previous article" navigation

Why this matters:

- increases time on site
- creates stronger internal linking
- makes the journal feel connected to the catalog
- turns every post into a browsing entry point

Likely files involved:

- `app/journal/[slug]/page.tsx`
- `lib/sanity/articles.server.ts`
- `lib/sanity/queries.ts`
- `components/Containers/Blog/RelatedArticlesSection.tsx`

### 2. Improve the journal index for browsing

Priority: highest

`app/journal/JournalIndexClient.tsx` is currently a simple grid. That works for a small number of articles, but it will get weaker as volume grows.

Add:

- featured/latest split
- tag filtering
- search
- pagination or "load more"
- clearer topical grouping if editorial themes emerge

Why this matters:

- makes older content discoverable
- gives users multiple entry points
- improves usefulness as the archive grows

Likely files involved:

- `app/journal/page.tsx`
- `app/journal/JournalIndexClient.tsx`
- `lib/sanity/articles.server.ts`
- `lib/sanity/queries.ts`

### 3. Fix heading and metadata consistency

Priority: high

The journal index currently uses `TitleBanner` and also renders another large page heading inside `JournalIndexClient`, which likely creates an avoidable duplicate-page-heading experience. The journal pages also do not yet use the shared metadata helper used elsewhere.

Improve:

- heading structure so there is a single clear page `h1`
- canonical URLs through `buildPageMetadata`
- more consistent Open Graph and Twitter metadata
- JSON-LD upgrade from generic `Article` to `BlogPosting`

Why this matters:

- cleaner semantics and accessibility
- better SEO consistency with the rest of the app
- lower chance of page-shell drift over time

Likely files involved:

- `app/journal/page.tsx`
- `app/journal/JournalIndexClient.tsx`
- `app/journal/[slug]/page.tsx`
- `lib/sanity/json-ld.ts`
- `lib/seo/metadata.ts`
- `components/Organisms/TitleBanner/TitleBanner.tsx`

## Phase 2 - Discovery and Conversion

Once the article pages and index are stronger, the next wave should make the journal more effective at sending readers into the core product.

### 4. Expand contextual journal placement across the site

Priority: high

The site already shows related articles on perfume and house pages. That should expand into more surfaces where editorial can reinforce discovery.

Possible placements:

- home page featured article or latest stories strip
- archive pages for houses or perfume families
- exchange page sidebars or educational callouts
- compare page contextual reading
- trader-facing profile experiences where relevant

Why this matters:

- gives content more entry points
- improves article distribution without requiring social traffic
- reinforces the editorial identity of the product

### 5. Add stronger post-level CTAs

Priority: medium-high

Every journal article should give the reader an obvious next step related to the subject of the piece.

Examples:

- browse perfumes from this house
- view this perfume in the archive
- find collectors trading similar scents
- compare featured perfumes

These CTAs should be grounded in the referenced perfume and house slugs already stored in Sanity.

### 6. Add lightweight editorial signals

Priority: medium

Small signals make articles feel more complete and easier to scan:

- reading time
- last updated date when applicable
- author byline treatment
- article topic chips
- share/copy link actions

These are not the highest leverage items, but they improve perceived quality without requiring a full redesign.

## Phase 3 - Editorial Data Model and Authoring

The current schema is enough to publish articles, but it is still fairly manual and lightly structured.

### 7. Replace manual slug arrays with safer editorial linking

Priority: very high

`perfumeRefs` and `houseRefs` currently rely on editors entering slugs as strings. That is fragile and will eventually produce broken cross-links.

Best upgrade options:

- preferred: true structured references or reference-like linked objects in Sanity
- acceptable interim step: editor autocomplete / validation against known slugs

Why this matters:

- reduces authoring mistakes
- makes related-content logic more reliable
- improves confidence in automation and feed integration

Likely files involved:

- `sanity/schemaTypes/article.ts`
- any Sanity-side query helpers and validation logic

### 8. Add more structured editorial fields

Priority: high

Useful additions:

- featured flag
- series name or collection
- hero subtitle / dek
- SEO title and meta description overrides
- manual related-article overrides
- article status or editorial priority fields if needed

Why this matters:

- gives the journal more control without requiring custom code for every editorial need
- reduces the chance of overloading the body field with presentation responsibilities

### 9. Expand the article body toolkit only after discovery work lands

Priority: medium

`components/Containers/Blog/PortableTextContent.tsx` currently supports a fairly lean article format. That is fine for now.

Only after the higher-leverage work above, consider adding:

- lists
- callout blocks
- pull quotes
- inline perfume cards
- inline house cards
- richer image treatments
- embedded comparison or recommendation modules

This work should follow clear editorial use cases, not lead them.

## Phase 4 - Compounding Loops

This phase turns the journal from a content section into a retention system.

### 10. Use article relationships more aggressively in feeds and journeys

Priority: medium-high

The app already uses article references in:

- `models/activity-feed.server.ts`
- `models/scent-journey.server.ts`

Next step ideas:

- better article relevance selection for followed activity
- richer copy for why an article is being shown
- more visible article surfaces in scent-journey flows
- personalized article modules based on followed houses, perfumes, or user activity

### 11. Build topic pages once tags are stable

Priority: medium

If the tag system becomes editorially consistent, topic landing pages can become high-value SEO and discovery surfaces.

Examples:

- `/journal/tag/gourmand`
- `/journal/tag/rose`
- `/journal/tag/indie-houses`

This should happen only after tag hygiene is good enough to avoid low-quality archives.

### 12. Consider notifications or subscriptions later

Priority: low-medium

Potential later-stage ideas:

- follow the journal or specific topics
- alerts for new articles about followed houses
- digest email of recent stories

This is valuable, but only once the journal is clearly driving product value and there is enough publishing cadence to justify it.

## Suggested Delivery Order

If we want the most impact with the least risk, the order should be:

1. Article page related content and entity links.
2. Journal index discovery upgrades.
3. Metadata, canonical, heading, and JSON-LD cleanup.
4. Stronger contextual placements across the rest of the product.
5. Safer Sanity linking for perfumes and houses.
6. Structured editorial fields.
7. Richer portable text components.
8. Topic pages and retention loops.

## What Not to Do First

These are reasonable ideas, but they should not lead the roadmap:

- a full visual redesign of the journal
- adding lots of new content block types before discovery improves
- building newsletter or subscription systems before the journal proves product value
- creating many archive pages before tags and references are reliable

## Success Metrics

The journal is improving if we see movement in:

- click-through rate from article pages to perfume and house pages
- pages per session for visitors entering through journal content
- percentage of article sessions that continue into another product page
- article-to-article click-through rate
- organic traffic to journal detail pages and topic pages
- percentage of articles with valid perfume and house links

## Practical Next Step

If this roadmap becomes implementation work, the best first ship is:

1. add related articles plus referenced perfume/house sections to `app/journal/[slug]/page.tsx`
2. clean up metadata and heading structure
3. then upgrade the journal index with search/filter/featured behavior

That sequence improves the journal immediately without requiring a large redesign or a risky schema migration on day one.
