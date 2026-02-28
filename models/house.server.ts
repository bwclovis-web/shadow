import { HouseType, Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { assertValid, validationError } from "@/utils/errorHandling.patterns"
import { createUrlSlug } from "@/utils/slug"
const buildHouseOrderBy = (
  sortBy?: string,
  sortByType?: boolean
): Prisma.PerfumeHouseOrderByWithRelationInput => {
  if (sortBy) {
    switch (sortBy) {
      case "name-asc":
        return { name: "asc" }
      case "name-desc":
        return { name: "desc" }
      case "created-asc":
        return { createdAt: "asc" }
      case "type-asc":
        return { type: "asc" }
      default:
        return { createdAt: "desc" }
    }
  }
  return sortByType ? { type: "asc" } : { createdAt: "desc" }
}

export const getAllHousesWithOptions = async (options?: {
  sortByType?: boolean
  houseType?: string
  sortBy?: "name-asc" | "name-desc" | "created-desc" | "created-asc" | "type-asc"
  skip?: number
  take?: number
  selectFields?: boolean // If true, only return essential fields
  includeEmpty?: boolean // If true, include houses without perfumes (default: false for backward compatibility)
}) => {
  const {
    sortByType,
    houseType,
    sortBy,
    skip,
    take,
    selectFields,
    includeEmpty = false,
  } = options || {}

  const where: Prisma.PerfumeHouseWhereInput = {}

  // Only include houses that have at least one perfume (unless includeEmpty is true)
  if (!includeEmpty) {
    where.perfumes = {
      some: {},
    }
  }

  if (houseType && houseType !== "all") {
    where.type = houseType as HouseType
  }

  const orderBy = buildHouseOrderBy(sortBy, sortByType)

  // If selectFields is true, only return essential fields to reduce response size
  if (selectFields) {
    return prisma.perfumeHouse.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        country: true,
        founded: true,
        createdAt: true,
        updatedAt: true,
        // Exclude large fields like description, image, website, email, phone, address
      },
    })
  }

  return prisma.perfumeHouse.findMany({
    where,
    orderBy,
    skip,
    take,
  })
}

// Add a new function for paginated results with count
export const getHousesPaginated = async (options?: {
  sortByType?: boolean
  houseType?: string
  sortBy?: "name-asc" | "name-desc" | "created-desc" | "created-asc" | "type-asc"
  skip?: number
  take?: number
  selectFields?: boolean
  includeEmpty?: boolean // If true, include houses without perfumes
}) => {
  const {
    sortByType,
    houseType,
    sortBy,
    skip = 0,
    take = 50,
    selectFields,
    includeEmpty = false,
  } = options || {}

  const where: Prisma.PerfumeHouseWhereInput = {}

  // Only include houses that have at least one perfume (unless includeEmpty is true)
  if (!includeEmpty) {
    where.perfumes = {
      some: {},
    }
  }

  if (houseType && houseType !== "all") {
    where.type = houseType as HouseType
  }

  const orderBy = buildHouseOrderBy(sortBy, sortByType)

  const [houses, totalCount] = await Promise.all([
    selectFields
      ? prisma.perfumeHouse.findMany({
          where,
          orderBy,
          skip,
          take,
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            country: true,
            founded: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : prisma.perfumeHouse.findMany({
          where,
          orderBy,
          skip,
          take,
        }),
    prisma.perfumeHouse.count({ where }),
  ])

  return {
    houses,
    count: totalCount,
    hasMore: skip + take < totalCount,
    currentPage: Math.floor(skip / take) + 1,
    totalPages: Math.ceil(totalCount / take),
  }
}

// Simple getAllHouses for backward compatibility - now with pagination
export const getAllHouses = async (options?: {
  skip?: number
  take?: number
  selectFields?: boolean
  includeEmpty?: boolean
}) => {
  const { skip, take, selectFields, includeEmpty = false } = options || {}

  const where: Prisma.PerfumeHouseWhereInput = {}

  // Only include houses that have at least one perfume (unless includeEmpty is true)
  if (!includeEmpty) {
    where.perfumes = {
      some: {},
    }
  }

  if (selectFields) {
    return prisma.perfumeHouse.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        country: true,
        founded: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  return prisma.perfumeHouse.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  })
}

export const getHousesByLetter = async (letter: string, includeEmpty = false) => prisma.perfumeHouse.findMany({
    where: {
      name: {
        startsWith: letter,
        mode: "insensitive",
      },
      // Only include houses that have at least one perfume (unless includeEmpty is true)
      ...(includeEmpty
        ? {}
        : {
            perfumes: {
              some: {},
            },
          }),
    },
    orderBy: { name: "asc" },
  })

export const getHousesByLetterPaginated = async (
  letter: string,
  options: {
    skip: number
    take: number
    houseType?: string
    includeEmpty?: boolean
  }
) => {
  const { skip, take, houseType = "all", includeEmpty = false } = options

  const where: Prisma.PerfumeHouseWhereInput = {
    name: {
      startsWith: letter,
      mode: "insensitive",
    },
  }

  // Only include houses that have at least one perfume (unless includeEmpty is true)
  if (!includeEmpty) {
    where.perfumes = {
      some: {},
    }
  }

  // Add house type filter if not 'all'
  if (houseType && houseType !== "all") {
    where.type = houseType as HouseType
  }

  const [houses, totalCount] = await Promise.all([
    prisma.perfumeHouse.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        website: true,
        country: true,
        founded: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            perfumes: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    prisma.perfumeHouse.count({
      where,
    }),
  ])

  return {
    houses: houses.map(house => ({
      id: house.id,
      name: house.name,
      slug: house.slug,
      description: house.description,
      image: house.image,
      website: house.website,
      country: house.country,
      founded: house.founded,
      type: house.type,
      createdAt: house.createdAt,
      updatedAt: house.updatedAt,
      perfumeCount: house._count.perfumes,
    })),
    count: totalCount,
  }
}

export const getPerfumeHouseBySlug = async (
  slug: string,
  opts?: { skip?: number; take?: number }
) => {
  const house = await prisma.perfumeHouse.findUnique({
    where: { slug },
    include: {
      perfumes: {
        skip: opts?.skip ?? 0,
        take: opts?.take ?? 9,
        orderBy: { createdAt: "desc" }, // Add consistent ordering
      },
      _count: {
        select: {
          perfumes: true,
        },
      },
    },
  })

  if (!house) {
    return house
  }

  const perfumeCount = await prisma.perfume.count({
    where: {
      perfumeHouseId: house.id,
    },
  })

  return {
    ...house,
    perfumeCount,
  }
}

export const getPerfumeHouseById = async (
  id: string,
  opts?: { skip?: number; take?: number }
) => {
  const house = await prisma.perfumeHouse.findUnique({
    where: { id },
    include: {
      perfumes: {
        skip: opts?.skip ?? 0,
        take: opts?.take ?? 9,
        orderBy: { createdAt: "desc" }, // Add consistent ordering
      },
      _count: {
        select: {
          perfumes: true,
        },
      },
    },
  })

  if (!house) {
    return house
  }

  return {
    ...house,
    perfumeCount: house._count?.perfumes ?? house.perfumes?.length ?? 0,
  }
}

export const getPerfumeHouseByName = async (name: string) => {
  const house = await prisma.perfumeHouse.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  })

  return house
}

export const searchPerfumeHouseByName = async (
  name: string,
  includeEmpty = true
) => {
  const searchTerm = name.trim()

  if (!searchTerm) {
    return []
  }

  // Build the perfume filter condition based on includeEmpty flag
  const perfumeFilter = includeEmpty ? {} : { perfumes: { some: {} } }

  // First, try exact matches and starts-with matches (highest priority)
  const exactMatches = await prisma.perfumeHouse.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: { equals: searchTerm, mode: "insensitive" } },
            { name: { startsWith: searchTerm, mode: "insensitive" } },
          ],
        },
        perfumeFilter,
      ],
    },
    orderBy: { name: "asc" },
    take: 20,
    include: {
      _count: {
        select: { perfumes: true },
      },
    },
  })

  // Then, try contains matches (lower priority)
  const containsMatches = await prisma.perfumeHouse.findMany({
    where: {
      AND: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        // Exclude items already found in exact matches
        { id: { notIn: exactMatches.map(h => h.id) } },
        perfumeFilter,
      ],
    },
    orderBy: { name: "asc" },
    take: 20,
    include: {
      _count: {
        select: { perfumes: true },
      },
    },
  })

  // Combine and rank results
  const allResults = [...exactMatches, ...containsMatches]

  // Sort by relevance score
  const rankedResults = allResults
    .map(house => ({
      ...house,
      relevanceScore: calculateHouseRelevanceScore(house.name, searchTerm),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10)

  return rankedResults
}

// Helper function to calculate relevance score for houses
const calculateHouseRelevanceScore = (
  houseName: string,
  searchTerm: string
): number => {
  const name = houseName.toLowerCase()
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
    // This prioritizes specific versions or house branches
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

export const deletePerfumeHouse = async (id: string) => {
  const deletedHouse = await prisma.perfumeHouse.delete({
    where: {
      id,
    },
  })
  return deletedHouse
}

/**
 * Validates FormData fields for perfume house update
 * @throws {Error} if required fields are missing or invalid
 */
function validateHouseFormData(data: FormData): void {
  const name = data.get("name")
  const type = data.get("type")

  // Validate required fields
  assertValid(
    !!name && typeof name === "string" && name.trim().length > 0,
    "House name is required and must be a non-empty string",
    { field: "name", value: name }
  )

  assertValid(
    name.trim().length >= 2,
    "House name must be at least 2 characters long",
    { field: "name", length: name.trim().length }
  )

  assertValid(
    name.trim().length <= 200,
    "House name must be no more than 200 characters long",
    { field: "name", length: name.trim().length }
  )

  // Validate type if provided
  if (type && typeof type === "string") {
    const validTypes: HouseType[] = [
"niche", "designer", "indie", "mainstream"
]
    assertValid(
      validTypes.includes(type as HouseType),
      `Invalid house type. Must be one of: ${validTypes.join(", ")}`,
      { field: "type", value: type, validTypes }
    )
  }

  // Validate email format if provided
  const email = data.get("email")
  if (email && typeof email === "string" && email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    assertValid(emailRegex.test(email), "Invalid email format", {
      field: "email",
    })
  }

  // Validate website URL if provided
  const website = data.get("website")
  if (website && typeof website === "string" && website.trim().length > 0) {
    try {
      new URL(website)
    } catch {
      throw validationError("Invalid website URL format", {
        field: "website",
        value: website,
      })
    }
  }
}

export const updatePerfumeHouse = async (id: string, data: FormData) => {
  try {
    // Validate FormData fields before processing
    validateHouseFormData(data)

    const name = sanitizeText(data.get("name") as string)
    const type = parseHouseType(data.get("type"))
    const updatedHouse = await prisma.perfumeHouse.update({
      where: { id },
      data: {
        name,
        slug: createUrlSlug(name),
        description: sanitizeText(data.get("description") as string),
        image: data.get("image") as string,
        website: data.get("website") as string,
        country: data.get("country") as string,
        founded: data.get("founded") as string,
        type,
        email: data.get("email") as string,
        phone: data.get("phone") as string,
        address: data.get("address") as string,
      },
    })
    return { success: true, data: updatedHouse }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        success: false,
        error: `A perfume house with that ${
          Array.isArray(err.meta?.target) ? err.meta.target[0] : "value"
        } already exists.`,
      }
    }
    // Return validation errors or unexpected errors
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    }
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

const VALID_HOUSE_TYPES: HouseType[] = [
  "niche",
  "designer",
  "indie",
  "celebrity",
  "drugstore",
]

const parseHouseType = (value: FormDataEntryValue | null): HouseType => {
  if (typeof value === "string" && VALID_HOUSE_TYPES.includes(value as HouseType)) {
    return value as HouseType
  }
  return "indie"
}

export const createPerfumeHouse = async (data: FormData) => {
  try {
    const name = sanitizeText(data.get("name") as string)
    const slug = createUrlSlug(name)
    const rawType = data.get("type")
    const type: HouseType =
      typeof rawType === "string" && VALID_HOUSE_TYPES.includes(rawType as HouseType)
        ? (rawType as HouseType)
        : "indie"

    const newHouse = await prisma.perfumeHouse.create({
      data: {
        name,
        slug,
        description: sanitizeText(data.get("description") as string),
        image: data.get("image") as string,
        website: data.get("website") as string,
        country: data.get("country") as string,
        founded: data.get("founded") as string,
        type,
        email: data.get("email") as string,
        phone: data.get("phone") as string,
        address: data.get("address") as string,
      },
    })
    return { success: true, data: newHouse }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = err.meta?.target
      const fieldName = Array.isArray(target) ? target[0] : "value"

      return {
        success: false,
        error: `A perfume house with that ${fieldName} already exists. ${
          fieldName === "slug"
            ? `(Generated from name: "${sanitizeText(data.get("name") as string)}")`
            : ""
        }`,
      }
    }

    // Other errors (optional)
    return {
      success: false,
      error: `An unexpected error occurred: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    }
  }
}
