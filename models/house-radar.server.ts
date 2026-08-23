import { prisma } from "@/lib/db"
import { getScentDnaForUser } from "@/models/scent-dna.server"
import { classifyNoteNameToFamily } from "@/utils/scent-dna/note-families"

export type HouseRadarItem = {
  perfumeId: string
  perfumeName: string
  perfumeSlug: string
  perfumeImage: string | null
  houseId: string
  houseName: string
  houseSlug: string
  matchedFamily: string | null
  createdAt: string
}

/**
 * New releases from followed houses that match the user's palate (Phase 4.4).
 */
export const getHouseRadarItems = async (
  userId: string,
  limit = 8
): Promise<HouseRadarItem[]> => {
  const [follows, dna] = await Promise.all([
    prisma.userFollow.findMany({
      where: { followerId: userId, followingHouseId: { not: null } },
      select: { followingHouseId: true },
    }),
    getScentDnaForUser(userId),
  ])

  const houseIds = follows
    .map(f => f.followingHouseId)
    .filter((id): id is string => Boolean(id))
  if (houseIds.length === 0) return []

  const topFamilies = new Set(dna.topFamilies.slice(0, 3).map(f => f.family))
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const perfumes = await prisma.perfume.findMany({
    where: {
      perfumeHouseId: { in: houseIds },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      createdAt: true,
      perfumeHouse: {
        select: { id: true, name: true, slug: true },
      },
      perfumeNoteRelations: {
        take: 10,
        select: { note: { select: { name: true } } },
      },
    },
  })

  const items: HouseRadarItem[] = []
  for (const p of perfumes) {
    if (!p.perfumeHouse) continue
    const matchedFamily =
      p.perfumeNoteRelations
        .map(r => classifyNoteNameToFamily(r.note.name))
        .find(f => f && topFamilies.has(f)) ?? null

    // Prefer palate matches; still include followed-house releases without match
    if (topFamilies.size > 0 && !matchedFamily && items.length >= Math.ceil(limit / 2)) {
      continue
    }

    items.push({
      perfumeId: p.id,
      perfumeName: p.name,
      perfumeSlug: p.slug,
      perfumeImage: p.image,
      houseId: p.perfumeHouse.id,
      houseName: p.perfumeHouse.name,
      houseSlug: p.perfumeHouse.slug,
      matchedFamily,
      createdAt: p.createdAt.toISOString(),
    })
    if (items.length >= limit) break
  }

  return items
}
