import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { transformNotesForDisplay } from "@/models/perfume-notes-helpers"
import { createUrlSlug } from "@/utils/slug"

const buildPerfumeOrderBy = 
  (sortBy?: string): Prisma.PerfumeOrderByWithRelationInput => {
  if (sortBy) {
    switch (sortBy) {
      case "name-asc":
        return { name: "asc" }
      case "name-desc":
        return { name: "desc" }
      case "created-asc":
        return { createdAt: "asc" }
      default:
        return { createdAt: "desc" }
    }
  }
  return { createdAt: "desc" }
}
export const getAllPerfumes = async () => {
  const perfumes = await prisma.perfume.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      slug: true,
      perfumeHouseId: true,
      createdAt: true,
      updatedAt: true,
      perfumeHouse: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      },
    },
  })
  return perfumes
}

export const getSingleUserPerfumeById = async (userPerfumeId: string, userId: string) => {
  // Query by the actual userPerfume.id to get the specific destash entry
  const userPerfume = await prisma.userPerfume.findFirst({
  where: { id: userPerfumeId, userId },
  select: {
    id: true,
    perfumeId: true,
    userId: true,
    comments: {
      select: {
        id: true,
        userId: true,
        perfumeId: true,
        userPerfumeId: true,
        comment: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    },
    price: true,
    perfume: { 
      select: { 
        id: true, 
        name: true, 
        description: true, 
        image: true, 
        slug: true, 
        perfumeHouseId: true, 
        createdAt: true, 
        updatedAt: true,
        perfumeHouse: { 
          select: { id: true, 
            name: true, 
            slug: true, 
            type: true 
          } 
        } 
      } 
    },
    },
  })
  return userPerfume
}

export const getAllPerfumesWithOptions = async (options?: {
  sortBy?: "name-asc" | "name-desc" | "created-desc" | "created-asc" | "type-asc"
}) => {
  const { sortBy } = options || {}
  const orderBy = buildPerfumeOrderBy(sortBy)

  return prisma.perfume.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      slug: true,
      perfumeHouseId: true,
      createdAt: true,
      updatedAt: true,
      perfumeHouse: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      },
    },
    orderBy,
  })
}

export const getPerfumeBySlug = async (slug: string) => {
  const perfume = await prisma.perfume.findUnique({
    where: { slug },
    include: {
      perfumeHouse: true,
      // Use junction table for notes
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
  
  // Transform to backward-compatible format
  return transformNotesForDisplay(perfume as any)
}

export const getPerfumeById = async (id: string) => {
  const perfume = await prisma.perfume.findUnique({
    where: { id },
    include: {
      perfumeHouse: true,
      // Use junction table for notes
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
  
  // Transform to backward-compatible format
  return transformNotesForDisplay(perfume as any)
}

export const deletePerfume = async (id: string) => {
  const deletedHouse = await prisma.perfume.delete({
    where: {
      id,
    },
  })
  return deletedHouse
}

export const searchPerfumeByName = async (name: string) => {
  const searchTerm = name.trim()

  if (!searchTerm) {
    return []
  }

  // First, try exact matches and starts-with matches (highest priority)
  const exactMatches = await prisma.perfume.findMany({
    where: {
      OR: [
        { name: { equals: searchTerm, mode: "insensitive" } },
        { name: { startsWith: searchTerm, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      slug: true,
      perfumeHouseId: true,
      createdAt: true,
      updatedAt: true,
      perfumeHouse: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  })

  // Then, try contains matches (lower priority)
  const containsMatches = await prisma.perfume.findMany({
    where: {
      AND: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        // Exclude items already found in exact matches
        { id: { notIn: exactMatches.map(p => p.id) } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      slug: true,
      perfumeHouseId: true,
      createdAt: true,
      updatedAt: true,
      perfumeHouse: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  })

  // Combine and rank results
  const allResults = [...exactMatches, ...containsMatches]

  // Sort by relevance score
  const rankedResults = allResults
    .map(perfume => ({
      ...perfume,
      relevanceScore: calculateRelevanceScore(perfume.name, searchTerm),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10)

  return rankedResults
}

// Helper function to calculate relevance score
const calculateRelevanceScore = (
  perfumeName: string,
  searchTerm: string
): number => {
  const name = perfumeName.toLowerCase()
  const term = searchTerm.toLowerCase()

  let score = 0

  // Exact match gets highest score
  if (name === term) {
    score += 150
  }
  // Starts with gets high score
  else if (name.startsWith(term)) {
    score += 100

    // Bonus for "name - " pattern (search term followed by space and hyphen)
    // This prioritizes specific versions or flankers of the main perfume
    if (
      name.startsWith(term + " -") ||
      name.startsWith(term + " –") ||
      name.startsWith(term + " —")
    ) {
      score += 45
    } else if (name.startsWith(term + "-")) {
      // Smaller bonus for hyphen without space
      score += 20
    }
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

export const updatePerfume = async (id: string, data: FormData) => {
  try {
    const name = sanitizeText(data.get("name") as string)

    // Extract notes from FormData
    const topNotes = data.getAll("notesTop") as string[]
    const heartNotes = data.getAll("notesHeart") as string[]
    const baseNotes = data.getAll("notesBase") as string[]

    // Use transaction to update perfume and note relations
    const updatedPerfume = await prisma.$transaction(async tx => {
      // Update perfume basic info
      const perfume = await tx.perfume.update({
        where: { id },
        data: {
          name,
          slug: createUrlSlug(name),
          description: sanitizeText(data.get("description") as string),
          image: data.get("image") as string,
          perfumeHouse: {
            connect: {
              id: data.get("house") as string,
            },
          },
        },
      })

      // Delete existing note relations
      await tx.perfumeNoteRelation.deleteMany({
        where: { perfumeId: id },
      })

      // Create new note relations in junction table
      const relationsToCreate = [
        ...topNotes.map(noteId => ({
          perfumeId: id,
          noteId,
          noteType: "open" as const,
        })),
        ...heartNotes.map(noteId => ({
          perfumeId: id,
          noteId,
          noteType: "heart" as const,
        })),
        ...baseNotes.map(noteId => ({
          perfumeId: id,
          noteId,
          noteType: "base" as const,
        })),
      ]

      if (relationsToCreate.length > 0) {
        await tx.perfumeNoteRelation.createMany({
          data: relationsToCreate,
          skipDuplicates: true,
        })
      }

      return perfume
    })

    return { success: true, data: updatedPerfume }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { success: false, error: "Perfume already exists" }
    }
    throw err
  }
}

// Helper function to sanitize text input by normalizing Unicode characters and preventing XSS
const sanitizeText = (text: string | null): string => {
  if (!text) {
    return ""
  }

  return text
    .trim()
    .replace(/[<>]/g, "") // Remove angle brackets to prevent HTML/script tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers (onclick, onerror, etc.)
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .normalize("NFD") // Normalize Unicode
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[\u2013\u2014]/g, "-") // en dash, em dash → hyphen
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/[\u2026]/g, "...") // ellipsis
}

const findUniqueSlug = async (
  tx: Prisma.TransactionClient,
  baseSlug: string
): Promise<string> => {
  if (!baseSlug) return baseSlug
  let slug = baseSlug
  let n = 2
  while (await tx.perfume.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n}`
    n += 1
  }
  return slug
}

export const createPerfume = async (data: FormData) => {
  const name = sanitizeText(data.get("name") as string)
  const description = sanitizeText(data.get("description") as string)
  const image = data.get("image") as string
  const houseId = data.get("house") as string

  // Use transaction to create perfume and note relations
  const newPerfume = await prisma.$transaction(async tx => {
    const existing = await tx.perfume.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        perfumeHouseId: houseId,
      },
    })
    if (existing) {
      throw new Error(
        "Perfume already exists in the house it is being assigned to."
      )
    }

    const nameSlug = createUrlSlug(name)
    const existingSlug = await tx.perfume.findUnique({
      where: { slug: nameSlug },
      select: { id: true },
    })

    let slugBase = nameSlug
    if (existingSlug) {
      const house = await tx.perfumeHouse.findUnique({
        where: { id: houseId },
        select: { name: true },
      })
      const houseSlug = house?.name ? createUrlSlug(house.name) : ""
      if (houseSlug) {
        slugBase = `${nameSlug}-${houseSlug}`
      }
    }

    const slug = await findUniqueSlug(tx, slugBase)

    // Create perfume
    const perfume = await tx.perfume.create({
      data: {
        name,
        slug,
        description,
        image,
        perfumeHouse: {
          connect: { id: houseId },
        },
      },
    })

    // Create note relations in junction table
    const topNotes = data.getAll("notesTop") as string[]
    const heartNotes = data.getAll("notesHeart") as string[]
    const baseNotes = data.getAll("notesBase") as string[]

    const relationsToCreate = [
      ...topNotes.map(noteId => ({
        perfumeId: perfume.id,
        noteId,
        noteType: "open" as const,
      })),
      ...heartNotes.map(noteId => ({
        perfumeId: perfume.id,
        noteId,
        noteType: "heart" as const,
      })),
      ...baseNotes.map(noteId => ({
        perfumeId: perfume.id,
        noteId,
        noteType: "base" as const,
      })),
    ]

    if (relationsToCreate.length > 0) {
      await tx.perfumeNoteRelation.createMany({
        data: relationsToCreate,
        skipDuplicates: true,
      })
    }

    return perfume
  })

  return newPerfume
}

const availableForDecantingWhere = {
  userPerfume: {
    some: {
      available: {
        not: "0",
      },
    },
  },
} as const

const availableForDecantingSelect = {
  id: true,
  name: true,
  description: true,
  image: true,
  slug: true,
  perfumeHouseId: true,
  createdAt: true,
  updatedAt: true,
  perfumeHouse: {
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
    },
  },
  userPerfume: {
    where: {
      available: {
        not: "0",
      },
    },
    select: {
      id: true,
      perfumeId: true,
      available: true,
      amount: true,
      price: true,
      tradePrice: true,
      tradePreference: true,
      tradeOnly: true,
      type: true,
      userId: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      },
      comments: {
        where: {
          isPublic: true,
        },
        select: {
          id: true,
          userId: true,
          perfumeId: true,
          userPerfumeId: true,
          comment: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  },
} as const

export const getAvailablePerfumesForDecanting = async () => {
  const availablePerfumes = await prisma.perfume.findMany({
    where: availableForDecantingWhere,
    select: availableForDecantingSelect,
    orderBy: {
      name: "asc",
    },
  })
  return availablePerfumes
}

interface GetAvailablePerfumesForDecantingPaginatedOptions {
  skip?: number
  take?: number
  search?: string
}

export const getAvailablePerfumesForDecantingPaginated = async ({
  skip = 0,
  take = 16,
  search,
}: GetAvailablePerfumesForDecantingPaginatedOptions = {}) => {
  // Build where clause with optional search filter
  const whereClause = search
    ? {
        AND: [
          availableForDecantingWhere,
          {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { perfumeHouse: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          },
        ],
      }
    : availableForDecantingWhere

  const [perfumes, totalCount] = await Promise.all([
    prisma.perfume.findMany({
      where: whereClause,
      select: availableForDecantingSelect,
      orderBy: {
        name: "asc",
      },
      skip,
      take,
    }),
    prisma.perfume.count({
      where: whereClause,
    }),
  ])

  const pageSize = take
  const hasAnyData = totalCount > 0 && pageSize > 0
  const totalPages = hasAnyData ? Math.ceil(totalCount / pageSize) : 0
  const calculatedPage = pageSize > 0 ? Math.floor(skip / pageSize) + 1 : 1
  const currentPage = hasAnyData ? Math.min(calculatedPage, totalPages) : 1
  const hasMore = hasAnyData ? skip + perfumes.length < totalCount : false
  const hasNextPage = hasAnyData ? currentPage < totalPages : false
  const hasPrevPage = hasAnyData ? currentPage > 1 : false

  return {
    perfumes,
    meta: {
      totalCount,
      pageSize,
      currentPage,
      totalPages,
      hasMore,
      hasNextPage,
      hasPrevPage,
    },
  }
}

export const getPerfumesByLetterPaginated = async (
  letter: string,
  options: { skip: number; take: number }
) => {
  const { skip, take } = options

  const [perfumes, totalCount] = await Promise.all([
    prisma.perfume.findMany({
      where: {
        name: {
          startsWith: letter,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        slug: true,
        perfumeHouseId: true,
        createdAt: true,
        updatedAt: true,
        perfumeHouse: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    prisma.perfume.count({
      where: {
        name: {
          startsWith: letter,
          mode: "insensitive",
        },
      },
    }),
  ])

  return {
    perfumes,
    count: totalCount,
  }
}
