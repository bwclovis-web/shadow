import type { MetadataRoute } from "next"

import { prisma } from "@/lib/db"

export const revalidate = 86400

function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (fromEnv) return fromEnv
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

const STATIC_PATHS = [
  "/",
  "/about-us",
  "/behind-the-bottle",
  "/contact-us",
  "/how-we-work",
  "/terms-and-conditions",
  "/community-policy",
  "/the-exchange",
  "/the-vault",
  "/houses",
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
  }))

  const vaultLetterEntries: MetadataRoute.Sitemap = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => ({
    url: `${baseUrl}/the-vault/${letter}`,
    lastModified: now,
  }))

  let perfumeEntries: MetadataRoute.Sitemap = []
  let houseEntries: MetadataRoute.Sitemap = []

  try {
    const [perfumes, houses] = await Promise.all([
      prisma.perfume.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.perfumeHouse.findMany({ select: { slug: true, updatedAt: true } }),
    ])

    perfumeEntries = perfumes.map((p) => ({
      url: `${baseUrl}/perfume/${p.slug}`,
      lastModified: p.updatedAt,
    }))

    houseEntries = houses.map((h) => ({
      url: `${baseUrl}/houses/${h.slug}`,
      lastModified: h.updatedAt,
    }))
  } catch {
    // e.g. missing DATABASE_URL in local tooling — still serve static URLs
  }

  return [...staticEntries, ...vaultLetterEntries, ...houseEntries, ...perfumeEntries]
}
