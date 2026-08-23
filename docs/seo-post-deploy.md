# SEO post-deploy checklist

After deploying SEO crawl/trust fixes, complete these ops steps so Google can index the site.

## 1. Verify production endpoints

- [ ] `https://perfumershollow.com/robots.txt` — Allow `/`, Disallow admin/auth/API/exchanges, Sitemap URL present
- [ ] `https://perfumershollow.com/sitemap-index.xml` — HTTP **200**; sitemap index pointing at `/sitemap/static.xml`, `/sitemap/houses.xml`, `/sitemap/perfumes-0.xml`, …
- [ ] Spot-check a child sitemap (e.g. `/sitemap/perfumes-0.xml`) — under **50k** URLs; perfume chunks use 40k headroom
- [ ] `robots.txt` Sitemap lines include the index and child URLs
- [ ] Homepage HTML — no raw i18n keys like `home.radio.houses`
- [ ] Public hubs (`/membership`, `/community`, `/the-collectors-guide`) — titles use **perfumer's hollow** (not Shadow); `rel=canonical` present
- [ ] `https://perfumershollow.com/the-archive?q=rose` — returns a searchable Archive results page
- [ ] View source on `/` — WebSite JSON-LD `SearchAction` targets `/the-archive?q={search_term_string}`
- [ ] Organization JSON-LD email matches `CONTACT_INBOX_EMAIL` (default `contact@perfumershollow.com`)

## 2. Google Search Console

1. Confirm a property for `https://perfumershollow.com` (Domain or URL-prefix).
2. **Sitemaps** → submit `https://perfumershollow.com/sitemap-index.xml`. Remove any stale single-file `/sitemap.xml` submission if Coverage complains.
3. **URL inspection** → request indexing for:
   - `/`
   - `/the-archive`
   - `/houses`
   - `/scent-quiz` and `/compare` (growth pages)
   - 2–3 representative `/perfume/{slug}` and `/houses/{slug}` pages once the catalog has content
4. Monitor **Coverage / Pages** for soft-404s and “Discovered – currently not indexed” on thin PDPs.

## 3. Env (Vercel / production)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Canonical origin (`https://perfumershollow.com`) for sitemap, OG, JSON-LD |
| `CONTACT_INBOX_EMAIL` | Public contact + Organization schema email |
| Sanity project env | Journal URLs appear in the **static** child sitemap when articles are published |

## 4. After catalog / Journal growth

- Perfume chunk count grows automatically via `generateSitemaps`; re-submit `sitemap-index.xml` when perfume/house counts jump significantly.
- Publish Journal posts with internal links to perfume/house slugs (see [seo-journal-growth.md](./seo-journal-growth.md)).
- Prefer unique descriptions + notes on PDPs over thin scraped stubs.
