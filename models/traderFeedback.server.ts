import { Prisma } from "@prisma/client"

import { prisma } from "~/db.server"
import { validateRating } from "~/utils/api-route-helpers.server"

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

export async function submitTraderFeedback(input: TraderFeedbackSubmissionInput) {
  const { traderId, reviewerId, rating, comment } = input

  if (traderId === reviewerId) {
    throw new Error("You cannot leave feedback for yourself.")
  }

  validateRating(rating)

  try {
    return await prisma.traderFeedback.upsert({
      where: {
        traderId_reviewerId: {
          traderId,
          reviewerId,
        },
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

export async function removeTraderFeedback(
  traderId: string,
  reviewerId: string
) {
  try {
    return await prisma.traderFeedback.delete({
      where: {
        traderId_reviewerId: {
          traderId,
          reviewerId,
        },
      },
    })
  } catch (error: any) {
    if (error?.code === "P2025" || isMissingFeedbackTableError(error)) {
      return null
    }
    throw error
  }
}

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

export async function getTraderFeedbackList(
  traderId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<TraderFeedbackListItem[]> {
  const { limit = 10, offset = 0 } = options

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

    return feedback.map(entry => ({
      id: entry.id,
      traderId: entry.traderId,
      reviewerId: entry.reviewerId,
      rating: entry.rating,
      comment: entry.comment,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      reviewer: entry.reviewer,
    }))
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      return []
    }
    throw error
  }
}

export async function getTraderFeedbackByReviewer(
  traderId: string,
  reviewerId: string
) {
  try {
    return await prisma.traderFeedback.findUnique({
      where: {
        traderId_reviewerId: {
          traderId,
          reviewerId,
        },
      },
    })
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      return null
    }
    throw error
  }
}

function isMissingFeedbackTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"
  )
}

