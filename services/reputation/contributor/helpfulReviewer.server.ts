import { prisma } from "@/lib/db"

import { HELPFUL_REVIEWER_MIN_POSITIVE_REVIEWS } from "./constants"

/**
 * Reviews authored by the user with net positive helpfulness (helpful > unhelpful).
 */
export const countPositiveHelpfulReviewsByReviewer = async (
  reviewerId: string
): Promise<number> => {
  const rows = await prisma.traderFeedback.findMany({
    where: { reviewerId },
    select: { helpfulCount: true, unhelpfulCount: true },
  })

  return rows.filter((r) => r.helpfulCount > r.unhelpfulCount).length
}

export const qualifiesForHelpfulReviewer = async (
  reviewerId: string
): Promise<boolean> => {
  const count = await countPositiveHelpfulReviewsByReviewer(reviewerId)
  return count >= HELPFUL_REVIEWER_MIN_POSITIVE_REVIEWS
}
