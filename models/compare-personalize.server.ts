import {
  buildMaterialAvoidSet,
  buildMaterialPreferenceWeights,
  perfumeHasAvoidedMaterial,
  scorePerfumeNotesByMaterial,
  type NoteMaterialIndex,
} from "@/lib/note-materials"
import { prisma } from "@/lib/db"
import { getNoteMaterialIndex } from "@/models/note-materials.server"

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
 * Material-aware compare scoring (rollup via aliases + runtime rules).
 */
export const computeComparePersonalizationByMaterial = (
  orderedIds: string[],
  noteIdsByPerfumeId: Map<string, string[]>,
  noteNamesById: ReadonlyMap<string, string>,
  index: NoteMaterialIndex,
  materialWeights: Map<string, number>,
  avoidMaterials: Set<string>
): { winnerId: string | null; explainMaterialIds: string[] } => {
  let winnerId: string | null = null
  let best = -1
  let bestContrib: Record<string, number> = {}

  for (const id of orderedIds) {
    const noteIds = noteIdsByPerfumeId.get(id) ?? []
    if (perfumeHasAvoidedMaterial(index, noteIds, noteNamesById, avoidMaterials)) {
      continue
    }
    const { score, contribByMaterialId } = scorePerfumeNotesByMaterial(
      index,
      noteIds,
      noteNamesById,
      materialWeights
    )
    if (score > best) {
      best = score
      winnerId = id
      bestContrib = contribByMaterialId
    }
  }

  if (winnerId === null || best <= 0) {
    return { winnerId: null, explainMaterialIds: [] }
  }

  const explainMaterialIds = Object.entries(bestContrib)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([materialId]) => materialId)

  return { winnerId, explainMaterialIds }
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

  const index = await getNoteMaterialIndex()
  const noteWeights = (profile.noteWeights as Record<string, number>) ?? {}
  const avoidNoteIds = (profile.avoidNoteIds as string[]) ?? []
  const materialWeightsJson =
    (profile.materialWeights as Record<string, number>) ?? {}
  const materialAvoidIds = (profile.materialAvoidIds as string[]) ?? []

  const relations = await prisma.perfumeNoteRelation.findMany({
    where: { perfumeId: { in: orderedIds } },
    select: {
      perfumeId: true,
      noteId: true,
      note: { select: { id: true, name: true } },
    },
  })

  const noteIdsByPerfumeId = new Map<string, string[]>()
  const noteNamesById = new Map<string, string>()
  for (const r of relations) {
    noteNamesById.set(r.note.id, r.note.name)
    const list = noteIdsByPerfumeId.get(r.perfumeId) ?? []
    if (!list.includes(r.noteId)) list.push(r.noteId)
    noteIdsByPerfumeId.set(r.perfumeId, list)
  }

  const materialWeights = buildMaterialPreferenceWeights(index, {
    materialWeights: materialWeightsJson,
    noteWeights,
    noteNamesById,
  })

  if (materialWeights.size === 0) {
    return { winnerId: null, explainNotes: [] }
  }

  const avoidMaterials = buildMaterialAvoidSet(index, {
    materialAvoidIds,
    avoidNoteIds,
    noteNamesById,
  })

  const { winnerId, explainMaterialIds } = computeComparePersonalizationByMaterial(
    orderedIds,
    noteIdsByPerfumeId,
    noteNamesById,
    index,
    materialWeights,
    avoidMaterials
  )

  if (!winnerId || explainMaterialIds.length === 0) {
    return { winnerId: null, explainNotes: [] }
  }

  const materialRows = await prisma.noteMaterial.findMany({
    where: { id: { in: explainMaterialIds } },
    select: { id: true, name: true },
  })
  const nameById = new Map(materialRows.map((m) => [m.id, m.name]))

  const explainNotes = explainMaterialIds
    .map((id) => ({ name: nameById.get(id) ?? id }))
    .filter((n) => n.name.length > 0)

  return {
    winnerId,
    explainNotes,
  }
}
