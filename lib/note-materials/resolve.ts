import type { NoteMaterialIndex, ResolveNoteInput } from "./types"
import { deriveMaterialSlugFromNoteName, normalizeNoteName } from "./rules"

export const buildNoteMaterialIndex = (input: {
  materials: ReadonlyArray<{ id: string; slug: string; name: string }>
  aliases: ReadonlyArray<{ materialId: string; noteId: string }>
}): NoteMaterialIndex => {
  const materialById = new Map<string, { id: string; slug: string; name: string }>()
  const materialBySlug = new Map<string, { id: string; slug: string; name: string }>()
  const materialIdByNoteId = new Map<string, string>()
  const noteIdsByMaterialId = new Map<string, Set<string>>()

  for (const m of input.materials) {
    materialById.set(m.id, m)
    materialBySlug.set(m.slug, m)
    noteIdsByMaterialId.set(m.id, new Set())
  }

  for (const a of input.aliases) {
    materialIdByNoteId.set(a.noteId, a.materialId)
    noteIdsByMaterialId.get(a.materialId)?.add(a.noteId)
  }

  return {
    materialById,
    materialBySlug,
    materialIdByNoteId,
    noteIdsByMaterialId,
  }
}

export const resolveNoteToMaterialId = (
  index: NoteMaterialIndex,
  input: ResolveNoteInput
): string | null => {
  const fromDb = index.materialIdByNoteId.get(input.noteId)
  if (fromDb) return fromDb

  const slug = deriveMaterialSlugFromNoteName(input.noteName)
  if (!slug) return null
  return index.materialBySlug.get(slug)?.id ?? null
}

export const resolveNoteToMaterialSlug = (
  index: NoteMaterialIndex,
  input: ResolveNoteInput
): string | null => {
  const materialId = resolveNoteToMaterialId(index, input)
  if (!materialId) return null
  return index.materialById.get(materialId)?.slug ?? null
}

/** All note IDs that roll up to a material (DB aliases only). */
export const expandMaterialIdToNoteIds = (
  index: NoteMaterialIndex,
  materialId: string
): string[] => [...(index.noteIdsByMaterialId.get(materialId) ?? [])]

export type MaterialPreferenceWeights = Map<string, number>

/**
 * Effective material weights from quiz materials + legacy note weights mapped via resolver.
 */
export const buildMaterialPreferenceWeights = (
  index: NoteMaterialIndex,
  input: {
    materialWeights: Record<string, number>
    noteWeights: Record<string, number>
    noteNamesById: ReadonlyMap<string, string>
  }
): MaterialPreferenceWeights => {
  const out = new Map<string, number>()

  for (const [materialId, w] of Object.entries(input.materialWeights)) {
    if (!Number.isFinite(w) || w <= 0) continue
    if (!index.materialById.has(materialId)) continue
    out.set(materialId, (out.get(materialId) ?? 0) + w)
  }

  for (const [noteId, w] of Object.entries(input.noteWeights)) {
    if (!Number.isFinite(w) || w <= 0) continue
    const name = input.noteNamesById.get(noteId)
    if (!name) continue
    const materialId = resolveNoteToMaterialId(index, { noteId, noteName: name })
    if (!materialId) continue
    out.set(materialId, (out.get(materialId) ?? 0) + w)
  }

  return out
}

export const buildMaterialAvoidSet = (
  index: NoteMaterialIndex,
  input: {
    materialAvoidIds: string[]
    avoidNoteIds: string[]
    noteNamesById: ReadonlyMap<string, string>
  }
): Set<string> => {
  const out = new Set<string>()

  for (const id of input.materialAvoidIds) {
    if (index.materialById.has(id)) out.add(id)
  }

  for (const noteId of input.avoidNoteIds) {
    const name = input.noteNamesById.get(noteId)
    if (!name) continue
    const materialId = resolveNoteToMaterialId(index, { noteId, noteName: name })
    if (materialId) out.add(materialId)
  }

  return out
}

export type PerfumeMaterialScore = {
  score: number
  contribByMaterialId: Record<string, number>
}

/**
 * Score a perfume's notes against material preferences (one contribution per material per perfume).
 */
export const scorePerfumeNotesByMaterial = (
  index: NoteMaterialIndex,
  noteIds: string[],
  noteNamesById: ReadonlyMap<string, string>,
  materialWeights: MaterialPreferenceWeights
): PerfumeMaterialScore => {
  const seenMaterials = new Set<string>()
  let score = 0
  const contribByMaterialId: Record<string, number> = {}

  for (const noteId of noteIds) {
    const name = noteNamesById.get(noteId)
    if (!name) continue
    const materialId = resolveNoteToMaterialId(index, { noteId, noteName: name })
    if (!materialId || seenMaterials.has(materialId)) continue
    const w = materialWeights.get(materialId) ?? 0
    if (w <= 0) continue
    seenMaterials.add(materialId)
    score += w
    contribByMaterialId[materialId] = w
  }

  return { score, contribByMaterialId }
}

export const perfumeHasAvoidedMaterial = (
  index: NoteMaterialIndex,
  noteIds: string[],
  noteNamesById: ReadonlyMap<string, string>,
  avoidMaterials: Set<string>
): boolean => {
  if (avoidMaterials.size === 0) return false
  for (const noteId of noteIds) {
    const name = noteNamesById.get(noteId)
    if (!name) continue
    const materialId = resolveNoteToMaterialId(index, { noteId, noteName: name })
    if (materialId && avoidMaterials.has(materialId)) return true
  }
  return false
}

export const deriveMaterialSlugForPersistence = deriveMaterialSlugFromNoteName

export { normalizeNoteName }
