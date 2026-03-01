/**
 * Shared perfume CSV import library.
 *
 * Extracted from scripts/import-csv.ts so that both the CLI script and the
 * admin scraper API route can call the same logic with in-memory records.
 *
 * Key behaviours (all preserved from the original script):
 * - Same house → update existing perfume (CSV is source of truth)
 * - Different house → append "- HouseName" to avoid collisions
 * - Notes: always delete old relations, then re-create from CSV data
 * - Images: fix protocol-relative URLs; leave relative paths as-is
 */

import { type PerfumeNoteType, PrismaClient } from "@prisma/client"

import { createUrlSlug } from "@/utils/slug"
import type { PerfumeCsvRecord } from "@/types/scraper"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportResult {
  /** DB id of the created/updated perfume */
  id: string
  name: string
  /** Whether the record was newly created (true) or updated (false) */
  created: boolean
}

export interface ImportSummary {
  successful: ImportResult[]
  errors: Array<{ record: PerfumeCsvRecord; error: string }>
}

// ---------------------------------------------------------------------------
// Pure helpers (no DB access)
// ---------------------------------------------------------------------------

export function parseNotes(notesString: string): string[] {
  if (!notesString || notesString.trim() === "" || notesString === "[]") {
    return []
  }
  try {
    const parsed = JSON.parse(notesString)
    return Array.isArray(parsed) ? (parsed as unknown[]).map(String).filter(Boolean) : []
  } catch {
    return notesString
      .split(",")
      .map(n => n.trim().replace(/^["']|["']$/g, ""))
      .filter(n => n.length > 0)
  }
}

export function parseDescription(raw: string | null | undefined): {
  description: string | null
  extractedNotes: string[]
} {
  if (!raw?.trim()) return { description: null, extractedNotes: [] }
  const trimmed = raw.trim()
  if (trimmed.startsWith("{") || trimmed.startsWith("{{")) {
    try {
      const cleaned = trimmed.replace(/^\{+|\}+$/g, "")
      const parsed = JSON.parse(cleaned) as {
        cleaned_description?: string
        extracted_notes?: unknown
      }
      return {
        description: parsed.cleaned_description?.trim() ?? null,
        extractedNotes: Array.isArray(parsed.extracted_notes)
          ? (parsed.extracted_notes as unknown[]).map(String)
          : [],
      }
    } catch {
      // fall through
    }
  }
  return { description: trimmed, extractedNotes: [] }
}

export function fixImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl?.trim()) return null
  let url = imageUrl.trim()
  if (url.startsWith("//")) url = "https:" + url
  return url
}

function calculateDataCompleteness(data: {
  description?: string | null
  image?: string | null
  openNotes: string
  heartNotes: string
  baseNotes: string
}): number {
  let score = 0
  if (data.description?.trim()) score += 10
  if (data.image?.trim()) score += 10
  score += parseNotes(data.openNotes).length * 2
  score += parseNotes(data.heartNotes).length * 2
  score += parseNotes(data.baseNotes).length * 2
  return score
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function createOrGetPerfumeHouse(prisma: PrismaClient, houseName: string) {
  if (!houseName.trim()) return null
  const name = houseName.trim()
  const existing = await prisma.perfumeHouse.findUnique({ where: { name } })
  if (existing) return existing

  const base = createUrlSlug(name)
  let slug = base
  let n = 1
  while (await prisma.perfumeHouse.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`
  }
  return prisma.perfumeHouse.create({ data: { name, slug, type: "indie" } })
}

async function getOrCreateNote(prisma: PrismaClient, noteName: string) {
  if (!noteName.trim()) return null
  const name = noteName.trim().toLowerCase()
  const existing = await prisma.perfumeNotes.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  })
  if (existing) return existing
  return prisma.perfumeNotes.create({ data: { name } })
}

async function upsertNoteRelation(
  prisma: PrismaClient,
  perfumeId: string,
  noteId: string,
  noteType: PerfumeNoteType,
) {
  const exists = await prisma.perfumeNoteRelation.findUnique({
    where: { perfumeId_noteId_noteType: { perfumeId, noteId, noteType } },
  })
  if (!exists) {
    await prisma.perfumeNoteRelation.create({ data: { perfumeId, noteId, noteType } })
  }
}

// ---------------------------------------------------------------------------
// Core single-record import
// ---------------------------------------------------------------------------

async function importOneRecord(
  prisma: PrismaClient,
  data: PerfumeCsvRecord,
): Promise<ImportResult> {
  if (!data.name?.trim()) throw new Error("Record has no name")

  const house = data.perfumeHouse ? await createOrGetPerfumeHouse(prisma, data.perfumeHouse) : null
  const houseId = house?.id ?? null
  const perfumeName = data.name.trim()

  const existingPerfumes = await prisma.perfume.findMany({
    where: { name: perfumeName },
    include: {
      perfumeNoteRelations: { include: { note: true } },
    },
  })

  let perfume: { id: string; name: string }
  let created = false

  if (existingPerfumes.length > 0) {
    const sameHouse = existingPerfumes.filter(p => p.perfumeHouseId === houseId)

    if (sameHouse.length > 0) {
      // Pick the record with the most data and delete duplicates
      const scored = sameHouse.map(p => ({
        perfume: p,
        score: calculateDataCompleteness({
          description: p.description,
          image: p.image,
          openNotes: JSON.stringify(
            p.perfumeNoteRelations.filter(r => r.noteType === "open").map(r => r.note.name),
          ),
          heartNotes: JSON.stringify(
            p.perfumeNoteRelations.filter(r => r.noteType === "heart").map(r => r.note.name),
          ),
          baseNotes: JSON.stringify(
            p.perfumeNoteRelations.filter(r => r.noteType === "base").map(r => r.note.name),
          ),
        }),
      }))
      const best = scored.reduce((a, b) => (b.score > a.score ? b : a))

      for (const { perfume: p } of scored) {
        if (p.id !== best.perfume.id) {
          await prisma.perfume.delete({ where: { id: p.id } })
        }
      }

      const { description: parsedDescription } = parseDescription(data.description)
      perfume = await prisma.perfume.update({
        where: { id: best.perfume.id },
        data: {
          description: parsedDescription,
          image: fixImageUrl(data.image),
        },
      })
    } else {
      // Different house — append house name
      const houseName = data.perfumeHouse?.trim() ?? "Unknown"
      const newName = `${perfumeName} - ${houseName}`
      const renamedExists = await prisma.perfume.findFirst({
        where: { name: newName },
      })

      if (renamedExists) {
        if (renamedExists.perfumeHouseId === houseId) {
          const { description: parsedDescription } = parseDescription(data.description)
          perfume = await prisma.perfume.update({
            where: { id: renamedExists.id },
            data: {
              description: parsedDescription,
              image: fixImageUrl(data.image),
            },
          })
        } else {
          throw new Error(`Perfume "${newName}" already exists under a different house; skipping`)
        }
      } else {
        const base = createUrlSlug(newName)
        let slug = base
        let n = 1
        while (await prisma.perfume.findUnique({ where: { slug } })) slug = `${base}-${n++}`

        const { description: parsedDescription } = parseDescription(data.description)
        perfume = await prisma.perfume.create({
          data: {
            name: newName,
            description: parsedDescription,
            image: fixImageUrl(data.image),
            perfumeHouseId: houseId,
            slug,
          },
        })
        created = true
      }
    }
  } else {
    const base = createUrlSlug(perfumeName)
    let slug = base
    let n = 1
    while (await prisma.perfume.findUnique({ where: { slug } })) slug = `${base}-${n++}`

    const { description: parsedDescription } = parseDescription(data.description)
    perfume = await prisma.perfume.create({
      data: {
        name: perfumeName,
        description: parsedDescription,
        image: fixImageUrl(data.image),
        perfumeHouseId: houseId,
        slug,
      },
    })
    created = true
  }

  // Resolve notes
  let openNotes = parseNotes(data.openNotes)
  const heartNotes = parseNotes(data.heartNotes)
  const baseNotes = parseNotes(data.baseNotes)

  if (openNotes.length === 0) {
    const { extractedNotes } = parseDescription(data.description)
    if (extractedNotes.length > 0) openNotes = extractedNotes
  }

  // Replace all note relations (CSV is source of truth)
  await prisma.perfumeNoteRelation.deleteMany({ where: { perfumeId: perfume.id } })

  for (const n of openNotes) {
    const note = await getOrCreateNote(prisma, n)
    if (note) await upsertNoteRelation(prisma, perfume.id, note.id, "open")
  }
  for (const n of heartNotes) {
    const note = await getOrCreateNote(prisma, n)
    if (note) await upsertNoteRelation(prisma, perfume.id, note.id, "heart")
  }
  for (const n of baseNotes) {
    const note = await getOrCreateNote(prisma, n)
    if (note) await upsertNoteRelation(prisma, perfume.id, note.id, "base")
  }

  return { id: perfume.id, name: perfume.name, created }
}

// ---------------------------------------------------------------------------
// Public: batch import
// ---------------------------------------------------------------------------

/**
 * Import an array of PerfumeCsvRecord objects into the database.
 *
 * Accepts an optional `prismaClient` so callers can pass a shared instance.
 * When not provided, a new PrismaClient is created and disconnected afterwards.
 */
export async function importPerfumeRecords(
  records: PerfumeCsvRecord[],
  options?: { prismaClient?: PrismaClient },
): Promise<ImportSummary> {
  const ownClient = !options?.prismaClient
  const prisma = options?.prismaClient ?? new PrismaClient()
  const summary: ImportSummary = { successful: [], errors: [] }

  try {
    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      try {
        const result = await importOneRecord(prisma, rec)
        summary.successful.push(result)
      } catch (err) {
        summary.errors.push({
          record: rec,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } finally {
    if (ownClient) await prisma.$disconnect()
  }

  return summary
}
