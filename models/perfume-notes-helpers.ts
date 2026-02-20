/**
 * Perfume Notes Helpers
 * 
 * Helper functions for working with the perfume notes junction table structure.
 * Transforms junction table data to display format used by components.
 */

import type { PrismaClient } from "@prisma/client"

import type { Perfume, PerfumeNotes } from "@/types/database"

/**
 * Type for perfume with junction table relations
 */
export interface PerfumeNoteRelation {
  id: string
  perfumeId: string
  noteId: string
  noteType: "open" | "heart" | "base"
  createdAt: Date
  note?: PerfumeNotes
}

export interface PerfumeWithNotes extends Perfume {
  perfumeNoteRelations?: (PerfumeNoteRelation & { note?: PerfumeNotes })[]
}

/**
 * Transform junction table structure to display format
 * Converts perfumeNoteRelations to arrays organized by note type
 * 
 * @param perfume - Perfume object with perfumeNoteRelations
 * @returns Perfume object with note arrays (perfumeNotesOpen, perfumeNotesHeart, perfumeNotesClose)
 */
export function transformNotesForDisplay<T extends PerfumeWithNotes>(perfume: T): T & {
  perfumeNotesOpen: PerfumeNotes[]
  perfumeNotesHeart: PerfumeNotes[]
  perfumeNotesClose: PerfumeNotes[]
} {
  const relations = perfume.perfumeNoteRelations || []
  
  // Extract notes by type from junction table
  const openNotes = relations
    .filter(r => r.noteType === "open" && r.note)
    .map(r => r.note as PerfumeNotes)
  
  const heartNotes = relations
    .filter(r => r.noteType === "heart" && r.note)
    .map(r => r.note as PerfumeNotes)
  
  const baseNotes = relations
    .filter(r => r.noteType === "base" && r.note)
    .map(r => r.note as PerfumeNotes)
  
  return {
    ...perfume,
    perfumeNoteRelations: relations,
    perfumeNotesOpen: openNotes,
    perfumeNotesHeart: heartNotes,
    perfumeNotesClose: baseNotes,
  }
}

/**
 * Get perfume with notes using junction table structure
 * Automatically transforms to display format
 * 
 * @param prisma - Prisma client instance
 * @param where - Prisma where clause for finding perfume
 * @returns Perfume with notes in display format
 */
export async function getPerfumeWithNotes(
  prisma: PrismaClient,
  where: { slug: string } | { id: string }
) {
  const perfume = await prisma.perfume.findUnique({
    where,
    include: {
      perfumeHouse: true,
      perfumeNoteRelations: {
        include: {
          note: true,
        },
      },
    },
  })

  if (!perfume) {
    return null
  }

  return transformNotesForDisplay(perfume as PerfumeWithNotes)
}


