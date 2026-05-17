import { prisma } from "@/lib/db"
import type { SeasonKey } from "@/types/perfume-season-vote"
import { getCurrentSeasonKey } from "@/utils/season-calendar"

export type SeasonalTrendingPerfumeRow = {
  perfumeId: string
  voteCount: number
  name: string
  slug: string
  image: string | null
  perfumeHouse: {
    id: string
    name: string
    slug: string
  } | null
}

export type SeasonalTrendingResult = {
  season: SeasonKey
  perfumes: SeasonalTrendingPerfumeRow[]
}

const perfumeSelect = {
  id: true,
  name: true,
  slug: true,
  image: true,
  perfumeHouse: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const

export const getSeasonalTrendingPerfumes = async (
  limit = 10,
  season: SeasonKey = getCurrentSeasonKey()
): Promise<SeasonalTrendingResult> => {
  const grouped = await prisma.userPerfumeSeasonVote.groupBy({
    by: ["perfumeId"],
    where: { [season]: true },
    _count: { perfumeId: true },
    orderBy: { _count: { perfumeId: "desc" } },
    take: limit,
  })

  if (grouped.length === 0) {
    return { season, perfumes: [] }
  }

  const perfumes = await prisma.perfume.findMany({
    where: { id: { in: grouped.map(row => row.perfumeId) } },
    select: perfumeSelect,
  })

  const perfumeById = new Map(perfumes.map(p => [p.id, p]))

  const perfumesRanked: SeasonalTrendingPerfumeRow[] = []
  for (const row of grouped) {
    const perfume = perfumeById.get(row.perfumeId)
    if (!perfume) continue
    perfumesRanked.push({
      perfumeId: perfume.id,
      voteCount: row._count.perfumeId,
      name: perfume.name,
      slug: perfume.slug,
      image: perfume.image,
      perfumeHouse: perfume.perfumeHouse,
    })
  }

  return { season, perfumes: perfumesRanked }
}
