import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  getHelpfulnessAggregatesForFeedbackIds,
  type HelpfulnessVoteValue,
} from "@/models/traderFeedbackHelpfulness.server"
import { computeTraderReputationV1 } from "@/services/reputation/computeReputation"
import { loadContributorBadges } from "@/services/reputation/contributor/loadContributorBadges.server"
import type { ContributorBadgeIdPhase1 } from "@/services/reputation/contributor/types"
import { loadTraderMessageReplyStats } from "@/services/reputation/loadReputationInputs.server"
import { getTraderTradeStats } from "@/services/reputation/tradeStats.server"
import type { TraderReputationV1 } from "@/services/reputation/types"
import { traderFeedbackRequiresCompletedTrade } from "@/utils/trader-feedback-config.server"
import { validateRating } from "@/utils/server/api-route-helpers.server"

/** Default number of feedback items returned in list endpoints */
const DEFAULT_LIST_LIMIT = 10

export type TraderFeedbackSort = "top" | "recent"

export interface TraderFeedbackSubmissionInput {
  traderId: string
  reviewerId: string
  rating: number
  comment?: string | null
  tradeId?: string | null
}

export interface TraderFeedbackSummary {
  traderId: string
  averageRating: number | null
  totalReviews: number
  badgeEligible: boolean
}

export interface TraderFeedbackListItem {
  id: string
  traderId: string
  reviewerId: string
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
  helpfulCount: number
  unhelpfulCount: number
  viewerHelpfulnessVote: HelpfulnessVoteValue | null
  verifiedSwap: boolean
  reviewer: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
  }
}

export interface TraderFeedbackViewerEntry {
  traderId: string
  reviewerId: string
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
}

/** Combined profile data: summary, paginated list, and current viewer's feedback (if any). */
export interface TraderFeedbackProfileData {
  summary: TraderFeedbackSummary
  comments: TraderFeedbackListItem[]
  viewerFeedback: TraderFeedbackViewerEntry | null
  reputation: TraderReputationV1
  contributorBadges: ContributorBadgeIdPhase1[]
  /** Viewer may submit new feedback (completed trade when gating is enabled) */
  canLeaveFeedback: boolean
  eligibleTradeId: string | null
}

const isMissingFeedbackTableError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"

type FeedbackWithReviewer = Prisma.TraderFeedbackGetPayload<{
  include: {
    reviewer: { select: { id: true; firstName: true; lastName: true; username: true } }
    trade: { select: { status: true } }
  }
}>

const isVerifiedSwap = (entry: FeedbackWithReviewer): boolean =>
  Boolean(entry.tradeId && entry.trade?.status === "completed")

const serializeFeedbackEntry = (
  entry: FeedbackWithReviewer,
  aggregate: {
    helpfulCount: number
    unhelpfulCount: number
    viewerVote: HelpfulnessVoteValue | null
  }
): TraderFeedbackListItem => ({
  id: entry.id,
  traderId: entry.traderId,
  reviewerId: entry.reviewerId,
  rating: entry.rating,
  comment: entry.comment,
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
  helpfulCount: aggregate.helpfulCount,
  unhelpfulCount: aggregate.unhelpfulCount,
  viewerHelpfulnessVote: aggregate.viewerVote,
  verifiedSwap: isVerifiedSwap(entry),
  reviewer: entry.reviewer,
})

/**
 * Most recent completed trade between two users (for feedback linkage).
 */
export const findCompletedTradeBetweenUsers = async (
  traderId: string,
  reviewerId: string
): Promise<string | null> => {
  try {
    const trade = await prisma.trade.findFirst({
      where: {
        status: "completed",
        OR: [
          { initiatorId: traderId, counterpartyId: reviewerId },
          { initiatorId: reviewerId, counterpartyId: traderId },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    })
    return trade?.id ?? null
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      return null
    }
    throw error
  }
}

const resolveFeedbackTradeId = async (
  traderId: string,
  reviewerId: string,
  tradeId?: string | null
): Promise<string | null> => {
  if (!traderFeedbackRequiresCompletedTrade()) {
    if (tradeId?.trim()) {
      const trade = await prisma.trade.findFirst({
        where: {
          id: tradeId.trim(),
          status: "completed",
          OR: [
            { initiatorId: traderId, counterpartyId: reviewerId },
            { initiatorId: reviewerId, counterpartyId: traderId },
          ],
        },
        select: { id: true },
      })
      return trade?.id ?? null
    }
    return findCompletedTradeBetweenUsers(traderId, reviewerId)
  }

  const resolved =
    tradeId?.trim() ??
    (await findCompletedTradeBetweenUsers(traderId, reviewerId))

  if (!resolved) {
    throw new Error(
      "You can leave feedback after completing a trade with this member."
    )
  }

  const trade = await prisma.trade.findFirst({
    where: {
      id: resolved,
      status: "completed",
      OR: [
        { initiatorId: traderId, counterpartyId: reviewerId },
        { initiatorId: reviewerId, counterpartyId: traderId },
      ],
    },
    select: { id: true },
  })

  if (!trade) {
    throw new Error("Invalid or ineligible trade for this feedback.")
  }

  return trade.id
}

/**
 * Submit or update feedback for a trader. One review per (trader, reviewer).
 * Use from API route with auth; validates rating and prevents self-review.
 */
export async function submitTraderFeedback(input: TraderFeedbackSubmissionInput) {
  const { traderId, reviewerId, rating, comment, tradeId } = input

  if (traderId === reviewerId) {
    throw new Error("You cannot leave feedback for yourself.")
  }

  validateRating(rating)

  const linkedTradeId = await resolveFeedbackTradeId(
    traderId,
    reviewerId,
    tradeId
  )

  try {
    const result = await prisma.traderFeedback.upsert({
      where: {
        traderId_reviewerId: { traderId, reviewerId },
      },
      create: {
        traderId,
        reviewerId,
        rating,
        comment: comment?.trim() || null,
        tradeId: linkedTradeId,
      },
      update: {
        rating,
        comment: comment?.trim() || null,
        ...(linkedTradeId ? { tradeId: linkedTradeId } : {}),
      },
    })

    const { notifyFollowersOfReview } = await import("@/models/follow-alerts.server")
    void notifyFollowersOfReview({ traderId, reviewerId, rating }).catch(err =>
      console.error("[follow-alerts] review notify failed:", err)
    )

    return result
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      throw new Error("Trader feedback system is not yet enabled.")
    }
    throw error
  }
}

/**
 * Remove the current user's feedback for a trader. Idempotent: returns null if no row.
 */
export async function removeTraderFeedback(
  traderId: string,
  reviewerId: string
) {
  try {
    return await prisma.traderFeedback.delete({
      where: { traderId_reviewerId: { traderId, reviewerId } },
    })
  } catch (error: unknown) {
    if (
      (error as { code?: string })?.code === "P2025" ||
      isMissingFeedbackTableError(error)
    ) {
      return null
    }
    throw error
  }
}

/**
 * Aggregate summary for a trader: average rating, total reviews, badge eligibility.
 */
export async function getTraderFeedbackSummary(traderId: string): Promise<TraderFeedbackSummary> {
  try {
    const aggregate = await prisma.traderFeedback.aggregate({
      where: { traderId },
      _avg: { rating: true },
      _count: { _all: true },
    })

    const totalReviews = aggregate._count._all
    return {
      traderId,
      averageRating: aggregate._avg.rating,
      totalReviews,
      badgeEligible: totalReviews >= 10,
    }
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      return {
        traderId,
        averageRating: null,
        totalReviews: 0,
        badgeEligible: false,
      }
    }
    throw error
  }
}

const listOrderBy = (
  sort: TraderFeedbackSort
): Prisma.TraderFeedbackOrderByWithRelationInput[] =>
  sort === "recent"
    ? [{ createdAt: "desc" }]
    : [
        { helpfulCount: "desc" },
        { unhelpfulCount: "asc" },
        { createdAt: "desc" },
      ]

/**
 * Paginated list of feedback for a trader, with reviewer info and helpfulness.
 */
export const getTraderFeedbackList = async (
  traderId: string,
  options: {
    limit?: number
    offset?: number
    sort?: TraderFeedbackSort
    viewerId?: string | null
  } = {}
): Promise<TraderFeedbackListItem[]> => {
  const {
    limit = DEFAULT_LIST_LIMIT,
    offset = 0,
    sort = "top",
    viewerId = null,
  } = options

  try {
    const feedback = await prisma.traderFeedback.findMany({
      where: { traderId },
      take: limit,
      skip: offset,
      orderBy: listOrderBy(sort),
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        trade: {
          select: { status: true },
        },
      },
    })

    const aggregates = await getHelpfulnessAggregatesForFeedbackIds(
      feedback.map((f) => f.id),
      viewerId
    )

    return feedback.map((entry) => {
      const aggregate = aggregates.get(entry.id) ?? {
        helpfulCount: entry.helpfulCount,
        unhelpfulCount: entry.unhelpfulCount,
        viewerVote: null,
      }
      return serializeFeedbackEntry(entry, aggregate)
    })
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      return []
    }
    throw error
  }
}

/**
 * Fetch a single feedback row for (trader, reviewer), or null if none.
 */
export async function getTraderFeedbackByReviewer(
  traderId: string,
  reviewerId: string
) {
  try {
    return await prisma.traderFeedback.findUnique({
      where: { traderId_reviewerId: { traderId, reviewerId } },
    })
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      return null
    }
    throw error
  }
}

/**
 * Load summary, paginated comments, and viewer's own feedback in one parallel round-trip.
 * Use in RSC (trader profile page) or API GET to avoid sequential requests.
 * Set includeList: false to skip the comments query when only summary/viewer feedback is needed.
 */
export const getTraderFeedbackForProfile = async (
  traderId: string,
  viewerId: string | null,
  options: {
    listLimit?: number
    listOffset?: number
    includeList?: boolean
    sort?: TraderFeedbackSort
  } = {}
): Promise<TraderFeedbackProfileData> => {
  const {
    listLimit = DEFAULT_LIST_LIMIT,
    listOffset = 0,
    includeList = true,
    sort = "top",
  } = options

  const [
    summary,
    comments,
    viewerRecord,
    messageStats,
    tradeStats,
    eligibleTradeId,
    contributorResult,
  ] = await Promise.all([
    getTraderFeedbackSummary(traderId),
    includeList
      ? getTraderFeedbackList(traderId, {
          limit: listLimit,
          offset: listOffset,
          sort,
          viewerId,
        })
      : Promise.resolve([]),
    viewerId && viewerId !== traderId
      ? getTraderFeedbackByReviewer(traderId, viewerId)
      : Promise.resolve(null),
    loadTraderMessageReplyStats(traderId),
    getTraderTradeStats(traderId),
    viewerId && viewerId !== traderId
      ? findCompletedTradeBetweenUsers(traderId, viewerId)
      : Promise.resolve(null),
    loadContributorBadges(traderId),
  ])

  const viewerFeedback: TraderFeedbackViewerEntry | null = viewerRecord
    ? {
        traderId: viewerRecord.traderId,
        reviewerId: viewerRecord.reviewerId,
        rating: viewerRecord.rating,
        comment: viewerRecord.comment,
        createdAt: viewerRecord.createdAt.toISOString(),
        updatedAt: viewerRecord.updatedAt.toISOString(),
      }
    : null

  const reputation = computeTraderReputationV1({
    feedback: {
      traderId: summary.traderId,
      averageRating: summary.averageRating,
      totalReviews: summary.totalReviews,
    },
    messageStats,
    tradeStats,
  })

  const requiresTrade = traderFeedbackRequiresCompletedTrade()
  const canLeaveFeedback =
    !viewerId ||
    viewerId === traderId ||
    Boolean(viewerFeedback) ||
    !requiresTrade ||
    Boolean(eligibleTradeId)

  return {
    summary,
    comments,
    viewerFeedback,
    reputation,
    contributorBadges: contributorResult.badges,
    canLeaveFeedback,
    eligibleTradeId,
  }
}
