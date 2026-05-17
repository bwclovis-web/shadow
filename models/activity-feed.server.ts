import { prisma } from "@/lib/db"

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_IN_WEEK = 7

const activityFeedListingSelect = {
  id: true,
  userId: true,
  createdAt: true,
  images: true,
  perfume: {
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
    },
  },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      avatarImage: true,
    },
  },
} as const

export type ActivityFeedListingRow = {
  id: string
  userId: string
  createdAt: Date
  images: string[]
  perfume: {
    id: string
    name: string
    slug: string
    image: string | null
  }
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string
    avatarImage: string | null
  }
}

const availableListingWhere = {
  available: { not: "0" },
  user: { isBanned: false },
} as const

export const getRecentlyListedActivity = async (
  limit = 12
): Promise<ActivityFeedListingRow[]> =>
  prisma.userPerfume.findMany({
    where: availableListingWhere,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: activityFeedListingSelect,
  })

export const getNewListingsSinceCount = async (since: Date): Promise<number> =>
  prisma.userPerfume.count({
    where: {
      ...availableListingWhere,
      createdAt: { gte: since },
    },
  })

export const getNewListingsThisWeekCount = async (): Promise<number> => {
  const weekAgo = new Date(Date.now() - DAYS_IN_WEEK * MS_PER_DAY)
  return getNewListingsSinceCount(weekAgo)
}
