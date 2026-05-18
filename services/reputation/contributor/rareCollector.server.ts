import { prisma } from "@/lib/db"

import {
  RARE_COLLECTOR_MAX_CANDIDATE_HOUSES,
  RARE_COLLECTOR_MAX_HOUSE_MEMBERS,
} from "./constants"

/** Pure helper for unit tests */
export const houseQualifiesAsNiche = (distinctCollectorCount: number): boolean =>
  distinctCollectorCount < RARE_COLLECTOR_MAX_HOUSE_MEMBERS

const getDistinctHouseIdsForUser = async (userId: string): Promise<string[]> => {
  const [ownedRows, tradedRows] = await Promise.all([
    prisma.userPerfume.findMany({
      where: { userId },
      select: { perfume: { select: { perfumeHouseId: true } } },
    }),
    prisma.tradeLineItem.findMany({
      where: {
        trade: {
          status: "completed",
          OR: [{ initiatorId: userId }, { counterpartyId: userId }],
        },
      },
      select: { userPerfume: { select: { perfume: { select: { perfumeHouseId: true } } } } },
    }),
  ])

  const houseIds = new Set<string>()
  for (const row of ownedRows) {
    const id = row.perfume.perfumeHouseId
    if (id) houseIds.add(id)
  }
  for (const row of tradedRows) {
    const id = row.userPerfume.perfume.perfumeHouseId
    if (id) houseIds.add(id)
  }

  return [...houseIds]
}

const countDistinctCollectorsForHouse = async (houseId: string): Promise<number> => {
  const groups = await prisma.userPerfume.groupBy({
    by: ["userId"],
    where: { perfume: { perfumeHouseId: houseId } },
  })
  return groups.length
}

export const qualifiesForRareCollector = async (userId: string): Promise<boolean> => {
  const houseIds = await getDistinctHouseIdsForUser(userId)
  if (houseIds.length === 0) return false

  const candidates = houseIds.slice(0, RARE_COLLECTOR_MAX_CANDIDATE_HOUSES)

  for (const houseId of candidates) {
    const count = await countDistinctCollectorsForHouse(houseId)
    if (houseQualifiesAsNiche(count)) return true
  }

  return false
}
