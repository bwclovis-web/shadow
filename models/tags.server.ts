import { prisma } from "~/db.server"
import { isDisplayableScentNote } from "~/utils/note-validation.server"

/** Returns only notes that pass display validation (so scent quiz etc. show confirmed scent notes only). */
export const getAllTags = async () => {
  const tags = await prisma.perfumeNotes.findMany({
    orderBy: { name: "asc" },
  })
  return tags.filter((tag) => isDisplayableScentNote(tag.name))
}

export const getTagsByName = async (name: string) => {
  const searchTerm = name.trim()

  if (!searchTerm) {
    return []
  }

  // First, try exact matches and starts-with matches (highest priority)
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

  // Then, try contains matches (lower priority)
  const containsMatches = await prisma.perfumeNotes.findMany({
    where: {
      AND: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        // Exclude items already found in exact matches
        { id: { notIn: exactMatches.map(t => t.id) } },
      ],
    },
    orderBy: { name: "asc" },
    take: 5,
  })

  // Combine and rank results, then filter to displayable only
  const allResults = [...exactMatches, ...containsMatches].filter((tag) =>
    isDisplayableScentNote(tag.name)
  )

  // Sort by relevance score
  const rankedResults = allResults
    .map(tag => ({
      ...tag,
      relevanceScore: calculateTagRelevanceScore(tag.name, searchTerm),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10)

  return rankedResults
}

// Helper function to calculate relevance score for tags
const calculateTagRelevanceScore = (tagName: string, searchTerm: string): number => {
  const name = tagName.toLowerCase()
  const term = searchTerm.toLowerCase()

  let score = 0

  // Exact match gets highest score
  if (name === term) {
    score += 100
  }
  // Starts with gets high score
  else if (name.startsWith(term)) {
    score += 80
  }
  // Contains gets medium score
  else if (name.includes(term)) {
    score += 40
  }

  // Bonus for shorter names (more specific matches)
  score += Math.max(0, 20 - name.length)

  // Bonus for matches at word boundaries
  const wordBoundaryRegex = new RegExp(`\\b${term}`, "i")
  if (wordBoundaryRegex.test(name)) {
    score += 20
  }

  return score
}

export const createTag = async (name: string) => {
  // Use upsert to ensure uniqueness - create if doesn't exist, get existing if it does
  const trimmedName = name.trim().toLowerCase()
  const tag = await prisma.perfumeNotes.upsert({
    where: { name: trimmedName },
    update: {}, // Don't update if exists
    create: {
      name: trimmedName,
    },
  })
  return tag
}
