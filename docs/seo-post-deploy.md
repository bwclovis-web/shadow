# SEO post-deploy checklist

After deploying the Phase 1 SEO crawl/trust fixes, complete these ops steps so Google can index the site.

## 1. Verify production endpoints

- [ ] `https://perfumershollow.com/robots.txt` — Allow `/`, Disallow admin/auth/API/exchanges, Sitemap URL present
- [ ] `https://perfumershollow.com/sitemap.xml` — HTTP **200** (not 500); includes hubs, A–Z archive letters, perfume/house URLs
- [ ] Homepage HTML — no raw i18n keys like `home.radio.houses`
- [ ] `https://perfumershollow.com/the-archive?q=rose` — returns a searchable Archive results page
- [ ] View source on `/` — WebSite JSON-LD `SearchAction` targets `/the-archive?q={search_term_string}`
- [ ] Organization JSON-LD email matches `CONTACT_INBOX_EMAIL` (default `contact@perfumershollow.com`)

## 2. Google Search Console

1. Confirm a property for `https://perfumershollow.com` (Domain or URL-prefix).
2. **Sitemaps** → submit `https://perfumershollow.com/sitemap.xml`.
3. **URL inspection** → request indexing for:
   - `/`
   - `/the-archive`
   - `/houses`
   - 2–3 representative `/perfume/{slug}` and `/houses/{slug}` pages once the catalog has content
4. Monitor **Coverage / Pages** for soft-404s and “Discovered – currently not indexed” on thin PDPs.

## 3. Env (Vercel / production)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Canonical origin (`https://perfumershollow.com`) for sitemap, OG, JSON-LD |
| `CONTACT_INBOX_EMAIL` | Public contact + Organization schema email |
| Sanity project env | Optional journal URLs in sitemap when articles are published |

## 4. After catalog / Journal growth

- Re-submit sitemap when perfume/house counts jump significantly.
- Publish Journal posts with internal links to perfume/house slugs (see [seo-journal-growth.md](./seo-journal-growth.md)).
- Prefer unique descriptions + notes on PDPs over thin scraped stubs.
