import { prisma } from "@/lib/db"
import { computeTopNoteFamilies } from "@/utils/scent-dna/compute-scent-dna"
import type { NoteFamilyId } from "@/utils/scent-dna/note-families"

const TOP_FAMILIES_LIMIT = 3

/**
 * Lightweight batch load of top Scent DNA note families per user (for match explanations).
 */
export const loadTopNoteFamiliesByUserIds = async (
  userIds: string[]
): Promise<Map<string, NoteFamilyId[]>> => {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const profiles = await prisma.scentProfile.findMany({
    where: { userId: { in: unique } },
    select: { userId: true, noteWeights: true },
  })

  const noteIds = new Set<string>()
  for (const profile of profiles) {
    const weights = (profile.noteWeights as Record<string, number> | null) ?? {}
    for (const id of Object.keys(weights)) noteIds.add(id)
  }

  const noteRows =
    noteIds.size > 0
      ? await prisma.perfumeNotes.findMany({
          where: { id: { in: [...noteIds] } },
          select: { id: true, name: true },
        })
      : []

  const noteNameById = new Map(noteRows.map(row => [row.id, row.name]))
  const out = new Map<string, NoteFamilyId[]>()

  for (const profile of profiles) {
    const weights = (profile.noteWeights as Record<string, number> | null) ?? {}
    const top = computeTopNoteFamilies(weights, noteNameById, TOP_FAMILIES_LIMIT)
    out.set(
      profile.userId,
      top.map(row => row.family)
    )
  }

  return out
}
