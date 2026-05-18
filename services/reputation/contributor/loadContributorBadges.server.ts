import { prisma } from "@/lib/db"
import {
  getFollowerCountForUser,
  getFollowingCountForUser,
} from "@/models/user-follow.server"
import { getTraderTradeStats } from "@/services/reputation/tradeStats.server"

import { computeContributorBadges } from "./computeContributorBadges"
import { countPositiveHelpfulReviewsByReviewer } from "./helpfulReviewer.server"
import { qualifiesForRareCollector } from "./rareCollector.server"
import type { ContributorBadgeInputs, ContributorBadgesResult } from "./types"

export const loadContributorBadgeInputs = async (
  traderId: string
): Promise<ContributorBadgeInputs> => {
  const [
    tradeStats,
    userRow,
    followerCount,
    followingUserCount,
    rareCollector,
    positiveHelpfulReviewCount,
  ] = await Promise.all([
    getTraderTradeStats(traderId),
    prisma.user.findUnique({
      where: { id: traderId },
      select: { strikeCount: true },
    }),
    getFollowerCountForUser(traderId),
    getFollowingCountForUser(traderId),
    qualifiesForRareCollector(traderId),
    countPositiveHelpfulReviewsByReviewer(traderId),
  ])

  return {
    traderId,
    completedTradeCount: tradeStats.completedCount,
    strikeCount: userRow?.strikeCount ?? 0,
    followerCount,
    followingUserCount,
    qualifiesForRareCollector: rareCollector,
    positiveHelpfulReviewCount,
  }
}

export const loadContributorBadges = async (
  traderId: string
): Promise<ContributorBadgesResult> => {
  const inputs = await loadContributorBadgeInputs(traderId)
  return computeContributorBadges(inputs)
}
