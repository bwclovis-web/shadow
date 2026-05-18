import { TradeStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { getPublishedArticlesWithRefs } from "@/lib/sanity/articles.server"
import type { ArticleListItem } from "@/lib/sanity/types"
import { getFollowedIdsForViewer } from "@/models/user-follow.server"

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_IN_WEEK = 7
const FOLLOWED_ACTIVITY_WINDOW_DAYS = 30

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

export type FollowedActivityTrader = {
  id: string
  firstName: string | null
  lastName: string | null
  username: string | null
  email: string
  avatarImage: string | null
}

export type FollowedActivityReview = {
  id: string
  traderId: string
  rating: number
  commentPreview: string | null
  trader: FollowedActivityTrader
  reviewer: FollowedActivityTrader
}

export type FollowedActivityItem =
  | { kind: "listing"; at: Date; listing: ActivityFeedListingRow }
  | {
      kind: "trade_completed"
      at: Date
      tradeId: string
      trader: FollowedActivityTrader
      perfumeNames: string[]
    }
  | { kind: "review"; at: Date; feedback: FollowedActivityReview }
  | {
      kind: "blog"
      at: Date
      article: ArticleListItem
      context?: "house" | "perfume"
    }

const traderSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  email: true,
  avatarImage: true,
} as const

const followedSince = () =>
  new Date(Date.now() - FOLLOWED_ACTIVITY_WINDOW_DAYS * MS_PER_DAY)

const getFollowedListings = async (
  followed: Awaited<ReturnType<typeof getFollowedIdsForViewer>>,
  since: Date,
  take: number
): Promise<FollowedActivityItem[]> => {
  const { userIds, houseIds, perfumeIds } = followed
  if (userIds.length === 0 && houseIds.length === 0 && perfumeIds.length === 0) {
    return []
  }

  const orConditions: object[] = []
  if (userIds.length > 0) orConditions.push({ userId: { in: userIds } })
  if (houseIds.length > 0) orConditions.push({ perfume: { perfumeHouseId: { in: houseIds } } })
  if (perfumeIds.length > 0) orConditions.push({ perfumeId: { in: perfumeIds } })

  const rows = await prisma.userPerfume.findMany({
    where: {
      ...availableListingWhere,
      createdAt: { gte: since },
      OR: orConditions,
    },
    orderBy: { createdAt: "desc" },
    take,
    select: activityFeedListingSelect,
  })

  return rows.map(listing => ({ kind: "listing" as const, at: listing.createdAt, listing }))
}

const getFollowedTrades = async (
  userIds: string[],
  since: Date,
  take: number
): Promise<FollowedActivityItem[]> => {
  if (userIds.length === 0) return []

  const trades = await prisma.trade.findMany({
    where: {
      status: TradeStatus.completed,
      updatedAt: { gte: since },
      OR: [{ initiatorId: { in: userIds } }, { counterpartyId: { in: userIds } }],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      updatedAt: true,
      initiatorId: true,
      counterpartyId: true,
      initiator: { select: traderSelect },
      counterparty: { select: traderSelect },
      lineItems: { select: { perfumeName: true }, take: 4 },
    },
  })

  return trades.map(trade => {
    const trader =
      userIds.includes(trade.initiatorId) ? trade.initiator : trade.counterparty
    return {
      kind: "trade_completed" as const,
      at: trade.updatedAt,
      tradeId: trade.id,
      trader,
      perfumeNames: trade.lineItems.map(li => li.perfumeName),
    }
  })
}

const getFollowedReviews = async (
  userIds: string[],
  since: Date,
  take: number
): Promise<FollowedActivityItem[]> => {
  if (userIds.length === 0) return []

  const rows = await prisma.traderFeedback.findMany({
    where: {
      createdAt: { gte: since },
      OR: [{ traderId: { in: userIds } }, { reviewerId: { in: userIds } }],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      traderId: true,
      rating: true,
      comment: true,
      createdAt: true,
      trader: { select: traderSelect },
      reviewer: { select: traderSelect },
    },
  })

  return rows.map(row => ({
    kind: "review" as const,
    at: row.createdAt,
    feedback: {
      id: row.id,
      traderId: row.traderId,
      rating: row.rating,
      commentPreview: row.comment
        ? row.comment.length > 120
          ? `${row.comment.slice(0, 117)}...`
          : row.comment
        : null,
      trader: row.trader,
      reviewer: row.reviewer,
    },
  }))
}

const getFollowedBlogArticles = async (
  followed: Awaited<ReturnType<typeof getFollowedIdsForViewer>>,
  since: Date,
  take: number
): Promise<FollowedActivityItem[]> => {
  const { houseSlugs, perfumeSlugs } = followed
  if (houseSlugs.length === 0 && perfumeSlugs.length === 0) return []

  const articles = await getPublishedArticlesWithRefs()
  const houseSlugSet = new Set(houseSlugs)
  const perfumeSlugSet = new Set(perfumeSlugs)

  const matched: FollowedActivityItem[] = []
  for (const article of articles) {
    const publishedAt = new Date(article.publishedAt)
    if (publishedAt < since) continue

    const houseHit = article.houseRefs?.some(ref => houseSlugSet.has(ref))
    const perfumeHit = article.perfumeRefs?.some(ref => perfumeSlugSet.has(ref))
    if (!houseHit && !perfumeHit) continue

    matched.push({
      kind: "blog",
      at: publishedAt,
      article,
      context: houseHit ? "house" : "perfume",
    })
    if (matched.length >= take) break
  }

  return matched
}

export const getFollowedActivity = async (
  viewerId: string,
  limit = 12
): Promise<FollowedActivityItem[]> => {
  const followed = await getFollowedIdsForViewer(viewerId)
  const hasAnyFollow =
    followed.userIds.length > 0 ||
    followed.houseIds.length > 0 ||
    followed.perfumeIds.length > 0
  if (!hasAnyFollow) return []

  const since = followedSince()
  const perType = Math.max(limit, 8)

  const [listings, trades, reviews, blogs] = await Promise.all([
    getFollowedListings(followed, since, perType),
    getFollowedTrades(followed.userIds, since, perType),
    getFollowedReviews(followed.userIds, since, perType),
    getFollowedBlogArticles(followed, since, perType),
  ])

  return [...listings, ...trades, ...reviews, ...blogs]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)
}
