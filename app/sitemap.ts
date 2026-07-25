import type { MetadataRoute } from "next"

import { prisma } from "@/lib/db"
import { getPublishedArticles } from "@/lib/sanity/articles.server"
import { getSiteUrl } from "@/lib/seo/site-url"

export const revalidate = 86400

/**
 * Single sitemap for hubs + catalog. Split into a sitemap index if total URLs
 * approach ~45k (Google’s practical per-file comfort zone is 50k).
 */
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

const HUB_PATHS = new Set([
  "/",
  "/the-archive",
  "/houses",
  "/the-exchange",
  "/journal",
])

const LEGAL_PATHS = new Set(["/terms-and-conditions", "/community-policy"])

const staticPriority = (path: string): number => {
  if (path === "/") return 1
  if (HUB_PATHS.has(path)) return 0.9
  if (LEGAL_PATHS.has(path)) return 0.3
  return 0.6
}

const staticChangeFrequency = (
  path: string,
): MetadataRoute.Sitemap[number]["changeFrequency"] => {
  if (path === "/" || HUB_PATHS.has(path)) return "daily"
  if (LEGAL_PATHS.has(path)) return "yearly"
  return "weekly"
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: staticChangeFrequency(path),
    priority: staticPriority(path),
  }))

  const archiveLetterEntries: MetadataRoute.Sitemap = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    .split("")
    .map((letter) => ({
      url: `${baseUrl}/the-archive/${letter}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
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

    perfumeEntries = perfumes
      .filter((p) => Boolean(p.slug?.trim()))
      .map((p) => ({
        url: `${baseUrl}/perfume/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))

    houseEntries = houses
      .filter((h) => Boolean(h.slug?.trim()))
      .map((h) => ({
        url: `${baseUrl}/houses/${h.slug}`,
        lastModified: h.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))

    articleEntries = articles.map((article) => ({
      url: `${baseUrl}/journal/${article.slug}`,
      lastModified: article.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
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
