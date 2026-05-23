import type { MetadataRoute } from "next"

import { prisma } from "@/lib/db"
import { getPublishedArticles } from "@/lib/sanity/articles.server"
import { getSiteUrl } from "@/lib/seo/site-url"

export const revalidate = 86400

const STATIC_PATHS = [
  "/",
  "/the-keepers",
  "/journal",
  "/correspondence",
  "/the-collectors-guide",
  "/terms-and-conditions",
  "/community-policy",
  "/the-exchange",
  "/the-archive",
  "/houses",
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
  }))

  const archiveLetterEntries: MetadataRoute.Sitemap = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => ({
    url: `${baseUrl}/the-archive/${letter}`,
    lastModified: now,
  }))

  let perfumeEntries: MetadataRoute.Sitemap = []
  let houseEntries: MetadataRoute.Sitemap = []
  let articleEntries: MetadataRoute.Sitemap = []

  try {
    const [perfumes, houses, articles] = await Promise.all([
      prisma.perfume.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.perfumeHouse.findMany({ select: { slug: true, updatedAt: true } }),
      getPublishedArticles(),
    ])

    perfumeEntries = perfumes.map((p) => ({
      url: `${baseUrl}/perfume/${p.slug}`,
      lastModified: p.updatedAt,
    }))

    houseEntries = houses.map((h) => ({
      url: `${baseUrl}/houses/${h.slug}`,
      lastModified: h.updatedAt,
    }))

    articleEntries = articles.map((article) => ({
      url: `${baseUrl}/journal/${article.slug}`,
      lastModified: article.publishedAt,
    }))
  } catch {
    // e.g. missing DATABASE_URL in local tooling — still serve static URLs
  }

  return [
    ...staticEntries,
    ...archiveLetterEntries,
    ...houseEntries,
    ...perfumeEntries,
    ...articleEntries,
  ]
}
