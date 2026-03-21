import { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"
import { cache } from "react"

import { prisma } from "@/lib/db"
import { deleteFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"
import { migratePerfumeImageToR2 } from "@/lib/r2-migrate"
import { transformNotesForDisplay } from "@/models/perfume-notes-helpers"
import { calculateRelevanceScore } from "@/utils/calculateRelevanceScore"
import {
  buildPerfumeCatalogNameOrderBy,
  buildPerfumeCursorOrderBy,
  clampPerfumeListTake,
  PERFUME_LIST_AGGREGATE_MAX_ROWS,
  PERFUME_LIST_MAX_TAKE,
  type PerfumeListSortBy,
} from "@/utils/server/perfume-cursor-order.server"
import { sanitizeText } from "@/utils/server/sanitize.server"
import { createUrlSlug } from "@/utils/slug"

const perfumeListSelect = {
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
} satisfies Prisma.PerfumeSelect

export type PerfumeListRow = Prisma.PerfumeGetPayload<{ select: typeof perfumeListSelect }>

export interface PerfumeListPage {
  items: PerfumeListRow[]
  nextCursor: string | null
}

const PERFUME_BY_SLUG_REVALIDATE = 3600

/**
 * Cursor-paginated perfumes, fixed sort: name asc, id asc (stable).
 */
export const getAllPerfumes = async (options?: {
  take?: number
  cursor?: string | null
}): Promise<PerfumeListPage> => {
  const take = clampPerfumeListTake(options?.take)
  const cursor = options?.cursor ?? ""
  return unstable_cache(
    async () => {
      const orderBy = buildPerfumeCatalogNameOrderBy()
      const rows = await prisma.perfume.findMany({
        select: perfumeListSelect,
        orderBy,
        take,
        ...(cursor
          ? { cursor: { id: cursor }, skip: 1 }
          : {}),
      })
      const nextCursor = rows.length === take ? rows[rows.length - 1]!.id : null
      return { items: rows, nextCursor }
    },
    ["get-all-perfumes", String(take), cursor],
    { revalidate: PERFUME_BY_SLUG_REVALIDATE, tags: ["perfume"] }
  )()
}

/**
 * Stitch catalog pages until exhausted or `PERFUME_LIST_AGGREGATE_MAX_ROWS` (for legacy full-list responses).
 */
export const fetchAllPerfumesForCatalog = async (): Promise<PerfumeListRow[]> => {
  const all: PerfumeListRow[] = []
  let cursor: string | null = null
  const pageSize = PERFUME_LIST_MAX_TAKE

  while (all.length < PERFUME_LIST_AGGREGATE_MAX_ROWS) {
    const { items, nextCursor } = await getAllPerfumes({ take: pageSize, cursor })
    all.push(...items)
    if (!nextCursor || items.length === 0) break
    cursor = nextCursor
  }
  return all
}

export const getSingleUserPerfumeById = async (userPerfumeId: string, userId: string) => {
  // Query by the actual userPerfume.id to get the specific destash entry
  const userPerfume = await prisma.userPerfume.findFirst({
  where: { id: userPerfumeId, userId },
  select: {
    id: true,
    perfumeId: true,
    userId: true,
    amount: true,
    available: true,
    type: true,
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
  sortBy?: PerfumeListSortBy
  take?: number
  cursor?: string | null
}): Promise<PerfumeListPage> => {
  const sortBy = options?.sortBy
  const take = clampPerfumeListTake(options?.take)
  const cursor = options?.cursor ?? ""
  const sortKey = sortBy ?? "created-desc"

  return unstable_cache(
    async () => {
      const orderBy = buildPerfumeCursorOrderBy(sortBy)
      const rows = await prisma.perfume.findMany({
        select: perfumeListSelect,
        orderBy,
        take,
        ...(cursor
          ? { cursor: { id: cursor }, skip: 1 }
          : {}),
      })
      const nextCursor = rows.length === take ? rows[rows.length - 1]!.id : null
      return { items: rows, nextCursor }
    },
    ["get-all-perfumes-with-options", sortKey, String(take), cursor],
    { revalidate: PERFUME_BY_SLUG_REVALIDATE, tags: ["perfume"] }
  )()
}

export const getPerfumeBySlug = cache(async (slug: string) => {
  return unstable_cache(
    async () => {
      const perfume = await prisma.perfume.findUnique({
        where: { slug },
        include: {
          perfumeHouse: true,
          perfumeNoteRelations: {
            include: {
              note: true,
            },
          },
        },
      })
      if (!perfume) return null
      return transformNotesForDisplay(perfume as any)
    },
    ["perfume-by-slug", slug],
    { revalidate: PERFUME_BY_SLUG_REVALIDATE, tags: ["perfume", `perfume-${slug}`] }
  )()
})

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
  const perfume = await prisma.perfume.findUnique({
    where: { id },
    select: { image: true },
  })
  if (perfume?.image) {
    const r2Key = getR2KeyFromPublicUrl(perfume.image)
    if (r2Key) {
      try {
        await deleteFromR2(r2Key)
      } catch (err) {
        console.error("[deletePerfume] Failed to delete image from R2:", r2Key, err)
        // Continue with DB delete; orphaned R2 object can be cleaned up later
      }
    }
  }
  const deleted = await prisma.perfume.delete({
    where: { id },
  })
  return deleted
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

export const updatePerfume = async (id: string, data: FormData) => {
  try {
    const name = sanitizeText(data.get("name") as string)

    // Capture old image URL before overwriting, so we can clean up R2 if it changes.
    const existing = await prisma.perfume.findUnique({
      where: { id },
      select: { image: true },
    })
    const oldImageUrl = existing?.image ?? null

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

    const imageUrl = (data.get("image") as string)?.trim()

    // Delete the old R2 object if the image URL changed and the old one was stored in R2.
    if (oldImageUrl && imageUrl !== oldImageUrl) {
      const oldKey = getR2KeyFromPublicUrl(oldImageUrl)
      if (oldKey) {
        try {
          await deleteFromR2(oldKey)
        } catch (err) {
          console.error("[updatePerfume] Failed to delete old image from R2:", oldKey, err)
          // Non-fatal: continue with update; orphaned object can be cleaned up later.
        }
      }
    }

    if (imageUrl) {
      await migratePerfumeImageToR2(id, imageUrl, { prismaClient: prisma })
      const refreshed = await prisma.perfume.findUnique({
        where: { id },
        include: {
          perfumeHouse: true,
          perfumeNoteRelations: { include: { note: true } },
        },
      })
      if (refreshed) {
        return { success: true, data: transformNotesForDisplay(refreshed as any) }
      }
    }
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
    const house = await tx.perfumeHouse.findUnique({
      where: { id: houseId },
      select: { name: true },
    })
    const houseName = house?.name?.trim() ?? ""

    const existing = await tx.perfume.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        perfumeHouseId: houseId,
      },
    })
    if (existing) {
      throw new Error(
        "A perfume with this name already exists for this house. Please choose a different name."
      )
    }

    const existingInOtherHouse = await tx.perfume.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        perfumeHouseId: { not: houseId },
      },
      select: { id: true },
    })

    const finalName =
      existingInOtherHouse && houseName ? `${name} - ${houseName}` : name

    const nameSlug = createUrlSlug(finalName)
    const existingSlug = await tx.perfume.findUnique({
      where: { slug: nameSlug },
      select: { id: true },
    })

    let slugBase = nameSlug
    if (existingSlug) {
      const houseSlug = houseName ? createUrlSlug(houseName) : ""
      if (houseSlug) {
        slugBase = `${nameSlug}-${houseSlug}`
      }
    }

    const slug = await findUniqueSlug(tx, slugBase)

    // Create perfume
    const perfume = await tx.perfume.create({
      data: {
        name: finalName,
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

  const imageUrl = (data.get("image") as string)?.trim()
  if (imageUrl) {
    await migratePerfumeImageToR2(newPerfume.id, imageUrl, { prismaClient: prisma })
  }
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
