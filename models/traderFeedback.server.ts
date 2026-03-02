import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"
import { validateRating } from "@/utils/server/api-route-helpers.server"

/** Default number of feedback items returned in list endpoints */
const DEFAULT_LIST_LIMIT = 10

export interface TraderFeedbackSubmissionInput {
  traderId: string
  reviewerId: string
  rating: number
  comment?: string | null
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
}

const isMissingFeedbackTableError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"

type FeedbackWithReviewer = Prisma.TraderFeedbackGetPayload<{
  include: {
    reviewer: { select: { id: true; firstName: true; lastName: true; username: true } }
  }
}>

function serializeFeedbackEntry(entry: FeedbackWithReviewer): TraderFeedbackListItem {
  return {
    id: entry.id,
    traderId: entry.traderId,
    reviewerId: entry.reviewerId,
    rating: entry.rating,
    comment: entry.comment,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    reviewer: entry.reviewer,
  }
}

/**
 * Submit or update feedback for a trader. One review per (trader, reviewer).
 * Use from API route with auth; validates rating and prevents self-review.
 */
export async function submitTraderFeedback(input: TraderFeedbackSubmissionInput) {
  const { traderId, reviewerId, rating, comment } = input

  if (traderId === reviewerId) {
    throw new Error("You cannot leave feedback for yourself.")
  }

  validateRating(rating)

  try {
    return await prisma.traderFeedback.upsert({
      where: {
        traderId_reviewerId: { traderId, reviewerId },
      },
      create: {
        traderId,
        reviewerId,
        rating,
        comment: comment?.trim() || null,
      },
      update: {
        rating,
        comment: comment?.trim() || null,
      },
    })
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

/**
 * Paginated list of feedback for a trader (newest first), with reviewer info.
 */
export async function getTraderFeedbackList(
  traderId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<TraderFeedbackListItem[]> {
  const { limit = DEFAULT_LIST_LIMIT, offset = 0 } = options

  try {
    const feedback = await prisma.traderFeedback.findMany({
      where: { traderId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    })
    return feedback.map(serializeFeedbackEntry)
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
export async function getTraderFeedbackForProfile(
  traderId: string,
  viewerId: string | null,
  options: { listLimit?: number; listOffset?: number; includeList?: boolean } = {}
): Promise<TraderFeedbackProfileData> {
  const {
    listLimit = DEFAULT_LIST_LIMIT,
    listOffset = 0,
    includeList = true,
  } = options

  const [summary, comments, viewerRecord] = await Promise.all([
    getTraderFeedbackSummary(traderId),
    includeList
      ? getTraderFeedbackList(traderId, { limit: listLimit, offset: listOffset })
      : Promise.resolve([]),
    viewerId && viewerId !== traderId
      ? getTraderFeedbackByReviewer(traderId, viewerId)
      : Promise.resolve(null),
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

  return { summary, comments, viewerFeedback }
}
