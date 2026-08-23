import { generateSitemaps } from "@/app/sitemap"
import { getSiteUrl } from "@/lib/seo/site-url"

export const runtime = "nodejs"
export const revalidate = 86400

/**
 * Next.js generateSitemaps serves children at /sitemap/{id}.xml but does not
 * always emit a discoverable index at /sitemap.xml — provide one explicitly.
 */
export const GET = async () => {
  const baseUrl = getSiteUrl()
  const sitemaps = await generateSitemaps()
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemaps.map(
      ({ id }) =>
        `  <sitemap><loc>${baseUrl}/sitemap/${id}.xml</loc></sitemap>`
    ),
    "</sitemapindex>",
    "",
  ].join("\n")

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
