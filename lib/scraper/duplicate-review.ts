import type { PrismaClient } from "@prisma/client"

import type { DuplicateRisk, PerfumeCsvRecord } from "@/types/scraper"

const normalizeForMatch = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s*-\s*[^-]+$/i, "") // drop trailing " - HouseName"
    .replace(/\([^)]*\)/g, "")
    .replace(/\d+\.?\d*\s*(ml|fl\s*oz|oz|g)\b/gi, "")
    .replace(/\b(eau de toilette|eau de parfum|edt|edp|parfum|extrait)\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** Simple token overlap ratio for fuzzy duplicate detection. */
const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0
  if (a === b) return 1
  const ta = new Set(a.split(/\s+/).filter(Boolean))
  const tb = new Set(b.split(/\s+/).filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) {
    if (tb.has(t)) inter++
  }
  return inter / Math.max(ta.size, tb.size)
}

const FUZZY_THRESHOLD = 0.85

export type AssessDuplicateOptions = {
  prismaClient: PrismaClient
}

/**
 * Annotate preview records with duplicateRisk before import.
 * Preserves existing import upsert behavior — only flags rows for admin review.
 */
export const assessDuplicateRisk = async (
  records: PerfumeCsvRecord[],
  { prismaClient }: AssessDuplicateOptions,
): Promise<PerfumeCsvRecord[]> => {
  if (records.length === 0) return records

  const houses = [...new Set(records.map(r => r.perfumeHouse).filter(Boolean))]
  const existing = await prismaClient.perfume.findMany({
    where: { perfumeHouse: { name: { in: houses } } },
    select: {
      id: true,
      name: true,
      slug: true,
      perfumeHouse: { select: { name: true } },
    },
  })

  const byHouse = new Map<string, typeof existing>()
  for (const p of existing) {
    const h = p.perfumeHouse?.name
    if (!h) continue
    if (!byHouse.has(h)) byHouse.set(h, [])
    byHouse.get(h)!.push(p)
  }

  return records.map(record => {
    const house = record.perfumeHouse
    const norm = normalizeForMatch(record.name)
    const candidates = byHouse.get(house) ?? []
    const matches: { name: string; similarity: number }[] = []

    for (const p of candidates) {
      if (record.name.toLowerCase() === p.name.toLowerCase()) {
        return {
          ...record,
          duplicateRisk: "none" as DuplicateRisk,
          duplicateMatches: [{ name: p.name, similarity: 1 }],
        }
      }

      const pNorm = normalizeForMatch(p.name)
      // Same perfume under this house after stripping " - HouseName" (intended upsert).
      if (norm && pNorm && norm === pNorm) {
        return {
          ...record,
          duplicateRisk: "none" as DuplicateRisk,
          duplicateMatches: [{ name: p.name, similarity: 1 }],
        }
      }

      const sim = similarity(norm, pNorm)
      if (sim >= FUZZY_THRESHOLD) {
        matches.push({ name: p.name, similarity: sim })
      }
    }

    if (matches.length === 0) {
      return { ...record, duplicateRisk: "none" as DuplicateRisk }
    }

    const best = matches.sort((a, b) => b.similarity - a.similarity)[0]!
    const risk: DuplicateRisk = best.similarity >= 0.95 ? "high" : "low"
    return {
      ...record,
      duplicateRisk: risk,
      duplicateMatches: matches.slice(0, 3),
    }
  })
}
