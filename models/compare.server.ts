/**
 * Batch data for the compare page (CF-002) and GET /api/compare (CF-003-ready).
 */

import { COMPARE_MAX_ITEMS } from "@/constants/compare"
import { prisma } from "@/lib/db"
import type { PerfumeWithNotes } from "@/models/perfume-notes-helpers"
import { transformNotesForDisplay } from "@/models/perfume-notes-helpers"
import { getPerfumeRatings } from "@/models/perfumeRating.server"

type PerfumeDisplay = ReturnType<
  typeof transformNotesForDisplay<PerfumeWithNotes>
>

export type ComparePerfumeNoteDto = {
  id: string
  name: string
}

export type CompareHouseDto = {
  id: string
  name: string
  slug: string
  type: string
}

export type CompareAverageRatingsDto = {
  longevity: number | null
  sillage: number | null
  gender: number | null
  priceValue: number | null
  overall: number | null
  totalRatings: number
}

export type ComparePerfumeDto = {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  perfumeHouse: CompareHouseDto | null
  perfumeNotesOpen: ComparePerfumeNoteDto[]
  perfumeNotesHeart: ComparePerfumeNoteDto[]
  perfumeNotesClose: ComparePerfumeNoteDto[]
  averageRatings: CompareAverageRatingsDto | null
  exchangeListingCount: number
}

/** Trim, drop empties, dedupe preserving first occurrence. */
export function normalizeCompareIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : ""
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function compareIdsExceedMax(ids: string[]): boolean {
  return ids.length > COMPARE_MAX_ITEMS
}

/**
 * Exchange-eligible listing counts per perfume (same rule as `availableForDecantingWhere`).
 */
export async function getExchangeListingCountsByPerfumeIds(
  perfumeIds: string[]
): Promise<Record<string, number>> {
  if (perfumeIds.length === 0) return {}

  const rows = await prisma.userPerfume.groupBy({
    by: ["perfumeId"],
    where: {
      perfumeId: { in: perfumeIds },
      available: { not: "0" },
    },
    _count: { _all: true },
  })

  const out: Record<string, number> = {}
  for (const row of rows) {
    out[row.perfumeId] = row._count._all
  }
  return out
}

function toNoteDtos(
  notes: { id: string; name: string }[]
): ComparePerfumeNoteDto[] {
  return notes.map((n) => ({ id: n.id, name: n.name }))
}

/**
 * Loads compare rows in the same order as `orderedIds` (skips unknown ids).
 * Caller must ensure `orderedIds.length <= COMPARE_MAX_ITEMS` after normalization.
 */
export async function getComparePayload(
  orderedIds: string[]
): Promise<ComparePerfumeDto[]> {
  if (orderedIds.length === 0) return []

  const uniqueSet = new Set(orderedIds)
  const uniqueIds = [...uniqueSet]

  const [rawPerfumes, listingCounts] = await Promise.all([
    prisma.perfume.findMany({
      where: { id: { in: uniqueIds } },
      include: {
        perfumeHouse: true,
        perfumeNoteRelations: {
          include: { note: true },
        },
      },
    }),
    getExchangeListingCountsByPerfumeIds(uniqueIds),
  ])

  const transformed = new Map<string, PerfumeDisplay>(
    rawPerfumes.map((p) => [
      p.id,
      transformNotesForDisplay(p as unknown as PerfumeWithNotes),
    ])
  )

  const ratingsEntries = await Promise.all(
    uniqueIds.map(async (id) => {
      const data = await getPerfumeRatings(id)
      return [id, data.averageRatings] as const
    })
  )
  const ratingsById = new Map(ratingsEntries)

  const rows: ComparePerfumeDto[] = []
  for (const id of orderedIds) {
    const p = transformed.get(id)
    if (!p) continue

    const house = p.perfumeHouse
    const avg = ratingsById.get(id) ?? null

    rows.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description ?? null,
      image: p.image ?? null,
      perfumeHouse: house
        ? {
            id: house.id,
            name: house.name,
            slug: house.slug,
            type: house.type,
          }
        : null,
      perfumeNotesOpen: toNoteDtos(p.perfumeNotesOpen ?? []),
      perfumeNotesHeart: toNoteDtos(p.perfumeNotesHeart ?? []),
      perfumeNotesClose: toNoteDtos(p.perfumeNotesClose ?? []),
      averageRatings: avg
        ? {
            longevity: avg.longevity ?? null,
            sillage: avg.sillage ?? null,
            gender: avg.gender ?? null,
            priceValue: avg.priceValue ?? null,
            overall: avg.overall ?? null,
            totalRatings: avg.totalRatings,
          }
        : null,
      exchangeListingCount: listingCounts[id] ?? 0,
    })
  }

  return rows
}
