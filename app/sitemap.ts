import type { MetadataRoute } from "next"

import { prisma } from "@/lib/db"
import { getAllPublishedArticles } from "@/lib/sanity/articles.server"
import { getSiteUrl } from "@/lib/seo/site-url"
import { isFeatureEnabled } from "@/utils/feature-flags"

export const runtime = "nodejs"
export const revalidate = 86400

/** Stay under Google’s 50k URLs/file limit with headroom for growth. */
const PERFUME_CHUNK_SIZE = 40_000

const STATIC_PATHS = [
  "/",
  "/the-keepers",
  "/journal",
  "/community",
  "/community/challenges",
  "/community/shelves",
  "/membership",
  "/correspondence",
  "/the-collectors-guide",
  "/terms-and-conditions",
  "/community-policy",
  "/the-exchange",
  "/the-archive",
  "/houses",
  "/scent-quiz",
  "/compare",
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

const buildStaticEntries = (
  baseUrl: string,
  now: Date
): MetadataRoute.Sitemap => {
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

  return [...staticEntries, ...archiveLetterEntries]
}

const fetchArticleEntries = async (
  baseUrl: string,
  fallback: Date
): Promise<MetadataRoute.Sitemap> => {
  try {
    const articles = await getAllPublishedArticles()
    const seen = new Set<string>()
    return articles.flatMap(article => {
      const slug = article.slug?.trim()
      if (!slug || seen.has(slug)) return []
      seen.add(slug)
      return [
        {
          url: `${baseUrl}/journal/${slug}`,
          lastModified: safeLastModified(article.publishedAt, fallback),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        },
      ]
    })
  } catch (error) {
    console.error("[sitemap] Sanity articles query failed:", error)
    return []
  }
}

const fetchChallengeEntries = async (
  baseUrl: string,
  fallback: Date
): Promise<MetadataRoute.Sitemap> => {
  try {
    const challenges = await prisma.communityChallenge.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    })
    return challenges
      .filter(c => Boolean(c.slug?.trim()))
      .map(c => ({
        url: `${baseUrl}/community/challenges/${c.slug}`,
        lastModified: safeLastModified(c.updatedAt, fallback),
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }))
  } catch (error) {
    console.error("[sitemap] challenge query failed:", error)
    return []
  }
}

const fetchShelfEntries = async (
  baseUrl: string,
  fallback: Date
): Promise<MetadataRoute.Sitemap> => {
  if (!isFeatureEnabled("communityShelves")) return []
  try {
    const shelves = await prisma.collectionShelf.findMany({
      where: { isPublic: true },
      select: { id: true, updatedAt: true },
    })
    return shelves.map(shelf => ({
      url: `${baseUrl}/community/shelf/${shelf.id}`,
      lastModified: safeLastModified(shelf.updatedAt, fallback),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    }))
  } catch (error) {
    console.error("[sitemap] public shelf query failed:", error)
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

const fetchPerfumeEntriesChunk = async (
  baseUrl: string,
  fallback: Date,
  chunkIndex: number
): Promise<MetadataRoute.Sitemap> => {
  try {
    const perfumes = await prisma.perfume.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
      skip: chunkIndex * PERFUME_CHUNK_SIZE,
      take: PERFUME_CHUNK_SIZE,
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
    console.error(`[sitemap] perfume chunk ${chunkIndex} query failed:`, error)
    return []
  }
}

const countPerfumes = async (): Promise<number> => {
  try {
    return await prisma.perfume.count()
  } catch (error) {
    console.error("[sitemap] perfume count failed:", error)
    return 0
  }
}

/**
 * Multiple sitemaps via generateSitemaps → Next serves an index at /sitemap.xml
 * and children at /sitemap/{id}.xml (static, houses, perfumes-0, …).
 */
export const generateSitemaps = async () => {
  const perfumeCount = await countPerfumes()
  const perfumeChunks = Math.max(1, Math.ceil(perfumeCount / PERFUME_CHUNK_SIZE))
  return [
    { id: "static" },
    { id: "houses" },
    ...Array.from({ length: perfumeChunks }, (_, i) => ({
      id: `perfumes-${i}`,
    })),
  ]
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id
  const baseUrl = getSiteUrl()
  const now = new Date()

  if (id === "static") {
    const [articleEntries, challengeEntries, shelfEntries] = await Promise.all([
      fetchArticleEntries(baseUrl, now),
      fetchChallengeEntries(baseUrl, now),
      fetchShelfEntries(baseUrl, now),
    ])
    return [
      ...buildStaticEntries(baseUrl, now),
      ...articleEntries,
      ...challengeEntries,
      ...shelfEntries,
    ]
  }

  if (id === "houses") {
    return fetchHouseEntries(baseUrl, now)
  }

  const perfumeMatch = /^perfumes-(\d+)$/.exec(id)
  if (perfumeMatch) {
    const chunkIndex = Number.parseInt(perfumeMatch[1]!, 10)
    return fetchPerfumeEntriesChunk(baseUrl, now, chunkIndex)
  }

  console.warn(`[sitemap] unknown sitemap id: ${id}`)
  return []
}
