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

import { sanitizeExtractedNoteCandidate } from "@/lib/scraper/note-source-confirmation"
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
  /** Whether the image field was set/updated (false when overwriteImageUrls was false and existing record had an image) */
  imageWasUpdated: boolean
  /** True when existing DB notes were kept because the incoming record would have thinned them */
  notesPreserved?: boolean
}

export interface ImportSummary {
  successful: ImportResult[]
  errors: Array<{ record: PerfumeCsvRecord; error: string }>
  /** Soft warnings (e.g. notes preserved against thinner import) */
  warnings?: string[]
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
    return Array.isArray(parsed)
      ? (parsed as unknown[])
          .map(String)
          .map(s => s.trim())
          .map(n => sanitizeExtractedNoteCandidate(n) ?? "")
          .filter(Boolean)
      : []
  } catch {
    return notesString
      .split(",")
      .map(n => n.trim().replace(/^["']|["']$/g, ""))
      .map(n => sanitizeExtractedNoteCandidate(n) ?? "")
      .filter(Boolean)
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
          ? (parsed.extracted_notes as unknown[])
              .map(String)
              .map(n => sanitizeExtractedNoteCandidate(n) ?? "")
              .filter(Boolean)
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

/** True when notes came from a labeled merchant pyramid (safe to replace DB notes). */
export const isLabeledMerchantPyramidSource = (source: string | undefined): boolean => {
  const s = (source ?? "").toLowerCase()
  if (!s) return false
  return (
    s.includes("text_regex_layered") ||
    s.startsWith("html_") ||
    s.includes("html_") ||
    s === "labeled_list" ||
    s === "merchant_structured"
  )
}

const merchantNotesTextForWrite = (data: PerfumeCsvRecord): string | undefined => {
  const t = data.merchantNotesText?.trim()
  return t ? t.slice(0, 8000) : undefined
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

type PerfumeWithNotes = {
  id: string
  name: string
  description: string | null
  image: string | null
  perfumeHouseId: string | null
  perfumeNoteRelations: Array<{ noteType: string; note: { name: string } }>
}

const scorePerfumeCompleteness = (p: PerfumeWithNotes): number =>
  calculateDataCompleteness({
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
  })

const pickBestSameHousePerfume = (sameHouse: PerfumeWithNotes[]): PerfumeWithNotes => {
  const scored = sameHouse.map(p => ({ perfume: p, score: scorePerfumeCompleteness(p) }))
  return scored.reduce((a, b) => (b.score > a.score ? b : a)).perfume
}

async function importOneRecord(
  prisma: PrismaClient,
  data: PerfumeCsvRecord,
  options?: { overwriteImageUrls?: boolean },
): Promise<ImportResult> {
  const overwriteImages = options?.overwriteImageUrls !== false
  if (!data.name?.trim()) throw new Error("Record has no name")

  const house = data.perfumeHouse ? await createOrGetPerfumeHouse(prisma, data.perfumeHouse) : null
  const houseId = house?.id ?? null
  const perfumeName = data.name.trim()
  const houseName = data.perfumeHouse?.trim() || house?.name?.trim() || "Unknown"
  const suffixName = `${perfumeName} - ${houseName}`

  // Prefer same-house matches: plain name OR legacy "Name - HouseName" rows.
  const sameHouseMatches: PerfumeWithNotes[] =
    houseId == null
      ? []
      : await prisma.perfume.findMany({
          where: {
            perfumeHouseId: houseId,
            OR: [{ name: perfumeName }, { name: suffixName }],
          },
          include: {
            perfumeNoteRelations: { include: { note: true } },
          },
        })

  const existingPerfumes = await prisma.perfume.findMany({
    where: { name: perfumeName },
    include: {
      perfumeNoteRelations: { include: { note: true } },
    },
  })

  let perfume: { id: string; name: string }
  let created = false
  let imageWasUpdated = true
  /** Existing relations on the perfume we are updating (same-house match). */
  let existingRelationsForPreserve: Array<{ noteType: string }> | null = null

  if (sameHouseMatches.length > 0) {
    const best = pickBestSameHousePerfume(sameHouseMatches)

    for (const p of sameHouseMatches) {
      if (p.id !== best.id) {
        await prisma.perfume.delete({ where: { id: p.id } })
      }
    }

    existingRelationsForPreserve = best.perfumeNoteRelations
    const { description: parsedDescription } = parseDescription(data.description)
    const existingImage = best.image
    const shouldSetImage = overwriteImages || !existingImage
    if (!shouldSetImage) imageWasUpdated = false
    const updateData: {
      description: string | null
      image?: string | null
      merchantNotesText?: string | null
    } = { description: parsedDescription }
    // Keep existing display name (including "Name - HouseName" when shared across houses).
    if (shouldSetImage) updateData.image = fixImageUrl(data.image)
    const merchantText = merchantNotesTextForWrite(data)
    if (merchantText) updateData.merchantNotesText = merchantText
    perfume = await prisma.perfume.update({
      where: { id: best.id },
      data: updateData,
    })
  } else if (existingPerfumes.length > 0) {
    // Plain name exists only under a different house — append house name
    const newName = suffixName
    const renamedExists = await prisma.perfume.findFirst({
      where: { name: newName },
      include: { perfumeNoteRelations: { include: { note: true } } },
    })

    if (renamedExists) {
      if (renamedExists.perfumeHouseId === houseId) {
        existingRelationsForPreserve = renamedExists.perfumeNoteRelations
        const { description: parsedDescription } = parseDescription(data.description)
        const shouldSetImage = overwriteImages || !renamedExists.image
        if (!shouldSetImage) imageWasUpdated = false
        const updateData: {
          description: string | null
          image?: string | null
          merchantNotesText?: string | null
        } = { description: parsedDescription }
        if (shouldSetImage) updateData.image = fixImageUrl(data.image)
        const merchantText = merchantNotesTextForWrite(data)
        if (merchantText) updateData.merchantNotesText = merchantText
        perfume = await prisma.perfume.update({
          where: { id: renamedExists.id },
          data: updateData,
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
          merchantNotesText: merchantNotesTextForWrite(data),
        },
      })
      created = true
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
        merchantNotesText: merchantNotesTextForWrite(data),
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

  // Deduplicate notes across layers so the same note is only written once
  // (first layer wins: open → heart → base).
  const seenNotes = new Set<string>()
  const deduped = (arr: string[]) => arr.filter(n => {
    const key = n.trim().toLowerCase()
    if (!key || seenNotes.has(key)) return false
    seenNotes.add(key)
    return true
  })
  const openNotesDeduped = deduped(openNotes)
  const heartNotesDeduped = deduped(heartNotes)
  const baseNotesDeduped = deduped(baseNotes)
  const incomingNoteCount =
    openNotesDeduped.length + heartNotesDeduped.length + baseNotesDeduped.length
  const existingNoteCount = existingRelationsForPreserve?.length ?? 0
  const merchantPyramid = isLabeledMerchantPyramidSource(data._noteSource)

  // Never thin: keep richer DB notes when incoming is thinner and not from a labeled merchant pyramid.
  if (
    !created &&
    existingNoteCount > 0 &&
    incomingNoteCount < existingNoteCount &&
    !merchantPyramid
  ) {
    return {
      id: perfume.id,
      name: perfume.name,
      created,
      imageWasUpdated,
      notesPreserved: true,
    }
  }

  // Replace all note relations (CSV is source of truth when allowed)
  await prisma.perfumeNoteRelation.deleteMany({ where: { perfumeId: perfume.id } })

  for (const n of openNotesDeduped) {
    const note = await getOrCreateNote(prisma, n)
    if (note) await upsertNoteRelation(prisma, perfume.id, note.id, "open")
  }
  for (const n of heartNotesDeduped) {
    const note = await getOrCreateNote(prisma, n)
    if (note) await upsertNoteRelation(prisma, perfume.id, note.id, "heart")
  }
  for (const n of baseNotesDeduped) {
    const note = await getOrCreateNote(prisma, n)
    if (note) await upsertNoteRelation(prisma, perfume.id, note.id, "base")
  }

  return { id: perfume.id, name: perfume.name, created, imageWasUpdated }
}

// ---------------------------------------------------------------------------
// Public: batch import
// ---------------------------------------------------------------------------

/**
 * Import an array of PerfumeCsvRecord objects into the database.
 *
 * Accepts optional `prismaClient` and `overwriteImageUrls` (default true).
 * When overwriteImageUrls is false, existing image URLs are left unchanged.
 */
export async function importPerfumeRecords(
  records: PerfumeCsvRecord[],
  options?: { prismaClient?: PrismaClient; overwriteImageUrls?: boolean },
): Promise<ImportSummary> {
  const ownClient = !options?.prismaClient
  const prisma = options?.prismaClient ?? new PrismaClient()
  const summary: ImportSummary = { successful: [], errors: [], warnings: [] }

  try {
    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      try {
        // Keep `_noteSource` for never-thin decisions; strip happens after importOneRecord.
        const result = await importOneRecord(prisma, rec, {
          overwriteImageUrls: options?.overwriteImageUrls,
        })
        summary.successful.push(result)
        if (result.notesPreserved) {
          summary.warnings?.push(
            `${result.name}: preserved existing DB notes (incoming record had fewer notes and was not a labeled merchant pyramid)`,
          )
        }
      } catch (err) {
        const { _noteSource: _strip, ...safeRec } = rec
        void _strip
        summary.errors.push({
          record: safeRec,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } finally {
    if (ownClient) await prisma.$disconnect()
  }

  return summary
}
