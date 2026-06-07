import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { calculateRelevanceScore } from "@/utils/calculateRelevanceScore"

export const searchPerfumeByName = async (name: string) => {
  return searchPerfumeByNameForViewer(name)
}

type PerfumeSearchViewerOptions = {
  viewerUserId?: string
}

const buildPerfumeVisibilityWhere = (viewerUserId?: string): Prisma.PerfumeWhereInput => {
  if (!viewerUserId) {
    return { isPending: false }
  }

  return {
    OR: [
      { isPending: false },
      {
        AND: [{ isPending: true }, { submittedBy: viewerUserId }],
      },
    ],
  }
}

export const searchPerfumeByNameForViewer = async (
  name: string,
  options: PerfumeSearchViewerOptions = {}
) => {
  const searchTerm = name.trim()
  const visibilityWhere = buildPerfumeVisibilityWhere(options.viewerUserId)

  if (!searchTerm) {
    return []
  }

  // First, try exact matches and starts-with matches (highest priority)
  const exactMatches = await prisma.perfume.findMany({
    where: {
      AND: [
        visibilityWhere,
        {
          OR: [
            { name: { equals: searchTerm, mode: "insensitive" } },
            { name: { startsWith: searchTerm, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      slug: true,
      isPending: true,
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
        visibilityWhere,
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
      isPending: true,
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
