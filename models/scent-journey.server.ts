import { cache } from "react"
import { TradeStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { getPublishedArticlesWithRefs } from "@/lib/sanity/articles.server"
import type { ArticleListItem } from "@/lib/sanity/types"
import { getTraderDisplayName } from "@/utils/user"

const DEFAULT_LIMIT = 30
const PER_SOURCE_TAKE = 40
const PROFILE_UPDATE_BUFFER_MS = 2_000

export type ScentJourneyBottleAdded = {
  kind: "bottle_added"
  at: Date
  userPerfumeId: string
  perfumeId: string
  perfumeName: string
  perfumeSlug: string
  perfumeImage: string | null
}

export type ScentJourneyTradeCompleted = {
  kind: "trade_completed"
  at: Date
  tradeId: string
  perfumeNames: string[]
  counterpartyId: string
  counterpartyName: string
}

export type ScentJourneyReviewWritten = {
  kind: "review_written"
  at: Date
  feedbackId: string
  traderId: string
  traderName: string
  rating: number
  commentPreview: string | null
}

export type ScentJourneyScentDna = {
  kind: "scent_dna"
  at: Date
  variant: "quiz" | "refined"
}

export type ScentJourneyBlogMention = {
  kind: "blog_mention"
  at: Date
  article: ArticleListItem
  context: "house" | "perfume"
}

export type ScentJourneyItem =
  | ScentJourneyBottleAdded
  | ScentJourneyTradeCompleted
  | ScentJourneyReviewWritten
  | ScentJourneyScentDna
  | ScentJourneyBlogMention

const commentPreview = (comment: string | null | undefined): string | null => {
  if (!comment?.trim()) return null
  const trimmed = comment.trim()
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed
}

const getBottleAddedEvents = async (
  userId: string,
  take: number
): Promise<ScentJourneyBottleAdded[]> => {
  const rows = await prisma.userPerfume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      createdAt: true,
      perfumeId: true,
      perfume: {
        select: {
          name: true,
          slug: true,
          image: true,
        },
      },
    },
  })

  return rows.map(row => ({
    kind: "bottle_added" as const,
    at: row.createdAt,
    userPerfumeId: row.id,
    perfumeId: row.perfumeId,
    perfumeName: row.perfume.name,
    perfumeSlug: row.perfume.slug,
    perfumeImage: row.perfume.image,
  }))
}

const getTradeCompletedEvents = async (
  userId: string,
  take: number
): Promise<ScentJourneyTradeCompleted[]> => {
  const trades = await prisma.trade.findMany({
    where: {
      status: TradeStatus.completed,
      OR: [{ initiatorId: userId }, { counterpartyId: userId }],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      updatedAt: true,
      initiatorId: true,
      counterpartyId: true,
      initiator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      },
      counterparty: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      },
      lineItems: { select: { perfumeName: true }, take: 4 },
    },
  })

  return trades.map(trade => {
    const counterparty =
      trade.initiatorId === userId ? trade.counterparty : trade.initiator
    return {
      kind: "trade_completed" as const,
      at: trade.updatedAt,
      tradeId: trade.id,
      perfumeNames: trade.lineItems.map(li => li.perfumeName),
      counterpartyId: counterparty.id,
      counterpartyName: getTraderDisplayName(counterparty),
    }
  })
}

const getReviewWrittenEvents = async (
  userId: string,
  take: number
): Promise<ScentJourneyReviewWritten[]> => {
  const rows = await prisma.traderFeedback.findMany({
    where: { reviewerId: userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      traderId: true,
      rating: true,
      comment: true,
      createdAt: true,
      trader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      },
    },
  })

  return rows.map(row => ({
    kind: "review_written" as const,
    at: row.createdAt,
    feedbackId: row.id,
    traderId: row.traderId,
    traderName: getTraderDisplayName(row.trader),
    rating: row.rating,
    commentPreview: commentPreview(row.comment),
  }))
}

const getScentDnaEvents = async (userId: string): Promise<ScentJourneyScentDna[]> => {
  const profile = await prisma.scentProfile.findUnique({
    where: { userId },
    select: {
      createdAt: true,
      updatedAt: true,
      lastQuizAt: true,
    },
  })

  if (!profile) return []

  const events: ScentJourneyScentDna[] = []

  if (profile.lastQuizAt) {
    events.push({
      kind: "scent_dna",
      at: profile.lastQuizAt,
      variant: "quiz",
    })
  }

  const updatedAfterCreate =
    profile.updatedAt.getTime() - profile.createdAt.getTime() > PROFILE_UPDATE_BUFFER_MS

  const quizAt = profile.lastQuizAt?.getTime() ?? null
  const updatedDiffersFromQuiz =
    quizAt === null || Math.abs(profile.updatedAt.getTime() - quizAt) > PROFILE_UPDATE_BUFFER_MS

  if (updatedAfterCreate && updatedDiffersFromQuiz) {
    events.push({
      kind: "scent_dna",
      at: profile.updatedAt,
      variant: "refined",
    })
  }

  return events
}

const getCollectionSlugs = async (userId: string) => {
  const rows = await prisma.userPerfume.findMany({
    where: { userId },
    select: {
      perfume: {
        select: {
          slug: true,
          perfumeHouse: { select: { slug: true } },
        },
      },
    },
  })

  const perfumeSlugs = new Set<string>()
  const houseSlugs = new Set<string>()

  for (const row of rows) {
    perfumeSlugs.add(row.perfume.slug)
    const houseSlug = row.perfume.perfumeHouse?.slug
    if (houseSlug) houseSlugs.add(houseSlug)
  }

  return { perfumeSlugs, houseSlugs }
}

const getBlogMentionEvents = async (
  userId: string,
  take: number
): Promise<ScentJourneyBlogMention[]> => {
  const { perfumeSlugs, houseSlugs } = await getCollectionSlugs(userId)
  if (perfumeSlugs.size === 0 && houseSlugs.size === 0) return []

  const articles = await getPublishedArticlesWithRefs()
  const matched: ScentJourneyBlogMention[] = []

  for (const article of articles) {
    const houseHit = article.houseRefs?.some(ref => houseSlugs.has(ref)) ?? false
    const perfumeHit = article.perfumeRefs?.some(ref => perfumeSlugs.has(ref)) ?? false
    if (!houseHit && !perfumeHit) continue

    matched.push({
      kind: "blog_mention",
      at: new Date(article.publishedAt),
      article,
      context: houseHit && !perfumeHit ? "house" : "perfume",
    })
    if (matched.length >= take) break
  }

  return matched.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take)
}

export const getScentJourneyForUser = cache(
  async (userId: string, limit = DEFAULT_LIMIT): Promise<ScentJourneyItem[]> => {
    const perSource = Math.max(limit, PER_SOURCE_TAKE)

    const [bottles, trades, reviews, scentDna, blogs] = await Promise.all([
      getBottleAddedEvents(userId, perSource),
      getTradeCompletedEvents(userId, perSource),
      getReviewWrittenEvents(userId, perSource),
      getScentDnaEvents(userId),
      getBlogMentionEvents(userId, perSource),
    ])

    return [...bottles, ...trades, ...reviews, ...scentDna, ...blogs]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit)
  }
)
