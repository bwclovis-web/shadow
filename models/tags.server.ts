import { prisma } from "@/lib/db"
import {
  isDisplayableScentNote,
  validateNoteForApi,
} from "@/utils/validation/note-validation.server"

const MAX_SEARCH_TERM_LENGTH = 100

/** Returns only notes that pass display validation (scent quiz etc. show confirmed scent notes only). */
export const getAllTags = async () => {
  const tags = await prisma.perfumeNotes.findMany({
    orderBy: { name: "asc" },
  })
  return tags.filter((tag) => isDisplayableScentNote(tag.name))
}

const calculateTagRelevanceScore = (tagName: string, searchTerm: string): number => {
  const name = tagName.toLowerCase()
  const term = searchTerm.toLowerCase()

  let score = 0

  if (name === term) score += 100
  else if (name.startsWith(term)) score += 80
  else if (name.includes(term)) score += 40

  score += Math.max(0, 20 - name.length)

  const wordBoundaryRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
  if (wordBoundaryRegex.test(name)) score += 20

  return score
}

/**
 * Search tags by name for autocomplete etc. Returns only displayable notes, ranked by relevance.
 * Safe for use in Next.js API routes (e.g. GET /api/getTag?tag=...).
 */
export const getTagsByName = async (name: string) => {
  const searchTerm = name.trim().slice(0, MAX_SEARCH_TERM_LENGTH)
  if (!searchTerm) return []

  const exactMatches = await prisma.perfumeNotes.findMany({
    where: {
      OR: [
        { name: { equals: searchTerm, mode: "insensitive" } },
        { name: { startsWith: searchTerm, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 5,
  })

  const containsMatches = await prisma.perfumeNotes.findMany({
    where: {
      AND: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { id: { notIn: exactMatches.map((t) => t.id) } },
      ],
    },
    orderBy: { name: "asc" },
    take: 5,
  })

  const allResults = [...exactMatches, ...containsMatches].filter((tag) =>
    isDisplayableScentNote(tag.name)
  )

  return allResults
    .map((tag) => ({
      ...tag,
      relevanceScore: calculateTagRelevanceScore(tag.name, searchTerm),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10)
}

export type CreateTagResult =
  | { success: true; tag: { id: string; name: string } }
  | { success: false; reason: string }

/**
 * Create a tag (perfume note) if it doesn't exist. Only allows displayable note names.
 * Use in Next.js API route POST /api/createTag; return CreateTagResult.reason for 400.
 */
export const createTag = async (name: string): Promise<CreateTagResult> => {
  const validation = validateNoteForApi(name)
  if (!validation.valid) {
    return { success: false, reason: validation.reason }
  }

  const trimmedName = name.trim().toLowerCase()

  const tag = await prisma.perfumeNotes.upsert({
    where: { name: trimmedName },
    update: {},
    create: { name: trimmedName },
  })

  return { success: true, tag: { id: tag.id, name: tag.name } }
}
