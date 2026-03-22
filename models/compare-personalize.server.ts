import { prisma } from "@/lib/db"

export type ComparePersonalizeNoteDto = { name: string }

export type ComparePersonalizeResult = {
  winnerId: string | null
  explainNotes: ComparePersonalizeNoteDto[]
}

/**
 * Pure scoring for tests and server: first max score in `orderedIds` order wins;
 * perfumes sharing any avoid-note id are disqualified.
 */
export function computeComparePersonalization(
  orderedIds: string[],
  noteIdsByPerfumeId: Map<string, string[]>,
  noteWeights: Record<string, number>,
  avoidNoteIds: Set<string>
): { winnerId: string | null; explainNoteIds: string[] } {
  let winnerId: string | null = null
  let best = -1

  for (const id of orderedIds) {
    const notes = noteIdsByPerfumeId.get(id) ?? []
    if (notes.some((n) => avoidNoteIds.has(n))) continue
    const score = notes.reduce((s, n) => s + (noteWeights[n] ?? 0), 0)
    if (score > best) {
      best = score
      winnerId = id
    }
  }

  if (winnerId === null || best <= 0) {
    return { winnerId: null, explainNoteIds: [] }
  }

  const winNotes = noteIdsByPerfumeId.get(winnerId) ?? []
  const explainNoteIds = winNotes
    .map((noteId) => ({ noteId, w: noteWeights[noteId] ?? 0 }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => x.noteId)

  return { winnerId, explainNoteIds }
}

/**
 * Picks a "best for you" compare column from ScentProfile note weights; explainable note names only.
 */
export async function getComparePersonalization(
  userId: string,
  orderedIds: string[]
): Promise<ComparePersonalizeResult> {
  if (orderedIds.length === 0) {
    return { winnerId: null, explainNotes: [] }
  }

  const profile = await prisma.scentProfile.findUnique({
    where: { userId },
  })

  if (!profile) {
    return { winnerId: null, explainNotes: [] }
  }

  const noteWeights = (profile.noteWeights as Record<string, number>) ?? {}
  const avoid = new Set((profile.avoidNoteIds as string[]) ?? [])

  const relations = await prisma.perfumeNoteRelation.findMany({
    where: { perfumeId: { in: orderedIds } },
    select: { perfumeId: true, noteId: true },
  })

  const noteIdsByPerfumeId = new Map<string, string[]>()
  for (const r of relations) {
    const list = noteIdsByPerfumeId.get(r.perfumeId) ?? []
    if (!list.includes(r.noteId)) list.push(r.noteId)
    noteIdsByPerfumeId.set(r.perfumeId, list)
  }

  const { winnerId, explainNoteIds } = computeComparePersonalization(
    orderedIds,
    noteIdsByPerfumeId,
    noteWeights,
    avoid
  )

  if (!winnerId || explainNoteIds.length === 0) {
    return { winnerId: null, explainNotes: [] }
  }

  const noteRows = await prisma.perfumeNotes.findMany({
    where: { id: { in: explainNoteIds } },
    select: { id: true, name: true },
  })
  const nameById = new Map(noteRows.map((n) => [n.id, n.name]))

  const explainNotes = explainNoteIds
    .map((id) => ({ name: nameById.get(id) ?? id }))
    .filter((n) => n.name.length > 0)

  return {
    winnerId,
    explainNotes,
  }
}
