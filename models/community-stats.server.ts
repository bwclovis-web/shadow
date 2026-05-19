import { TradeStatus } from "@prisma/client"
import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/db"

const COMMUNITY_STATS_REVALIDATE_SECONDS = 3600

const activeListingWhere = {
  available: { not: "0" },
  user: { isBanned: false },
} as const

export type CommunityStats = {
  bottlesListed: number
  tradesCompletedThisMonth: number
  members: number
}

const getStartOfCurrentMonthUtc = (): Date => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

const getCommunityStatsMonthCacheKey = (): string => {
  const start = getStartOfCurrentMonthUtc()
  return `${start.getUTCFullYear()}-${start.getUTCMonth() + 1}`
}

const fetchCommunityStats = async (): Promise<CommunityStats> => {
  const monthStart = getStartOfCurrentMonthUtc()

  const [bottlesListed, tradesCompletedThisMonth, members] = await Promise.all([
    prisma.userPerfume.count({ where: activeListingWhere }),
    prisma.trade.count({
      where: {
        status: TradeStatus.completed,
        updatedAt: { gte: monthStart },
      },
    }),
    prisma.user.count({ where: { isBanned: false } }),
  ])

  return { bottlesListed, tradesCompletedThisMonth, members }
}

export const getCommunityStats = (): Promise<CommunityStats> =>
  unstable_cache(
    fetchCommunityStats,
    ["community-stats", getCommunityStatsMonthCacheKey()],
    {
      revalidate: COMMUNITY_STATS_REVALIDATE_SECONDS,
      tags: ["community-stats"],
    }
  )()
