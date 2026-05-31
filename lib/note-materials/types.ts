import type { NoteFamilyId } from "@/utils/scent-dna/note-families"

export type NoteMaterialAliasSource = "seed" | "rule" | "manual"

export type NoteMaterialSeedEntry = {
  slug: string
  name: string
  family?: NoteFamilyId
  /** Explicit PerfumeNotes.name values (lowercase) to alias to this material */
  aliases?: string[]
}

export type MaterialForQuiz = {
  id: string
  slug: string
  name: string
}

export type NoteMaterialIndex = {
  materialById: Map<string, { id: string; slug: string; name: string }>
  materialBySlug: Map<string, { id: string; slug: string; name: string }>
  materialIdByNoteId: Map<string, string>
  noteIdsByMaterialId: Map<string, Set<string>>
}

export type ResolveNoteInput = {
  noteId: string
  noteName: string
}
