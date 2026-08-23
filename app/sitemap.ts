import type { MetadataRoute } from "next"

import { prisma } from "@/lib/db"
import { getPublishedArticles } from "@/lib/sanity/articles.server"
import { getSiteUrl } from "@/lib/seo/site-url"

export const runtime = "nodejs"
export const revalidate = 86400

/**
 * Single sitemap for hubs + catalog. Split into a sitemap index if total URLs
 * approach ~45k (Google’s practical per-file comfort zone is 50k).
 */
const STATIC_PATHS = [
  "/",
  "/the-keepers",
  "/journal",
  "/community",
  "/community/challenges",
  "/membership",
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
  path: string
): MetadataRoute.Sitemap[number]["changeFrequency"] => {
  if (path === "/" || HUB_PATHS.has(path)) return "daily"
  if (LEGAL_PATHS.has(path)) return "yearly"
  return "weekly"
}

/** Prefer a real Date; fall back to `fallback` when CMS/DB values are missing or invalid. */
const safeLastModified = (
  value: Date | string | null | undefined,
  fallback: Date
): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return fallback
}

const fetchPerfumeEntries = async (
  baseUrl: string,
  fallback: Date
): Promise<MetadataRoute.Sitemap> => {
  try {
    const perfumes = await prisma.perfume.findMany({
      select: { slug: true, updatedAt: true },
    })
    return perfumes
      .filter(p => Boolean(p.slug?.trim()))
      .map(p => ({
        url: `${baseUrl}/perfume/${p.slug}`,
        lastModified: safeLastModified(p.updatedAt, fallback),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
  } catch (error) {
    console.error("[sitemap] perfume query failed:", error)
    return []
  }
}

const fetchHouseEntries = async (
  baseUrl: string,
  fallback: Date
): Promise<MetadataRoute.Sitemap> => {
  try {
    const houses = await prisma.perfumeHouse.findMany({
      select: { slug: true, updatedAt: true },
    })
    return houses
      .filter(h => Boolean(h.slug?.trim()))
      .map(h => ({
        url: `${baseUrl}/houses/${h.slug}`,
        lastModified: safeLastModified(h.updatedAt, fallback),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
  } catch (error) {
    console.error("[sitemap] house query failed:", error)
    return []
  }
}

const fetchArticleEntries = async (
  baseUrl: string,
  fallback: Date
): Promise<MetadataRoute.Sitemap> => {
  try {
    const articles = await getPublishedArticles()
    return articles
      .filter(article => Boolean(article.slug?.trim()))
      .map(article => ({
        url: `${baseUrl}/journal/${article.slug}`,
        lastModified: safeLastModified(article.publishedAt, fallback),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }))
  } catch (error) {
    console.error("[sitemap] Sanity articles query failed:", error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(path => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: staticChangeFrequency(path),
    priority: staticPriority(path),
  }))

  const archiveLetterEntries: MetadataRoute.Sitemap = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    .split("")
    .map(letter => ({
      url: `${baseUrl}/the-archive/${letter}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }))

  // Fetch independently so Prisma vs Sanity failures never blank the whole sitemap.
  const [perfumeEntries, houseEntries, articleEntries] = await Promise.all([
    fetchPerfumeEntries(baseUrl, now),
    fetchHouseEntries(baseUrl, now),
    fetchArticleEntries(baseUrl, now),
  ])

  return [
    ...staticEntries,
    ...archiveLetterEntries,
    ...houseEntries,
    ...perfumeEntries,
    ...articleEntries,
  ]
}
