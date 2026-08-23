import type { MetadataRoute } from "next"

import { generateSitemaps } from "@/app/sitemap"
import { getSiteUrl } from "@/lib/seo/site-url"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = getSiteUrl()
  const childSitemaps = await generateSitemaps()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/sign-in", "/sign-up", "/exchanges/"],
    },
    // Index + children so crawlers find chunks even if /sitemap.xml is not an index.
    sitemap: [
      `${baseUrl}/sitemap-index.xml`,
      ...childSitemaps.map(({ id }) => `${baseUrl}/sitemap/${id}.xml`),
    ],
  }
}
