import type { NotesLayers } from "@/lib/scraper/stages/notes-layers"

export type { NotesLayers } from "@/lib/scraper/stages/notes-layers"

export const noteLayerCount = (n: NotesLayers): number =>
  n.openNotes.length + n.heartNotes.length + n.baseNotes.length

export const hasLayeredMerchantPyramid = (notes: NotesLayers): boolean =>
  notes.openNotes.length > 0 && (notes.heartNotes.length > 0 || notes.baseNotes.length > 0)
