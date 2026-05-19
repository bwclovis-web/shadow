import {
  COMMUNITY_PILLAR_MIN_FOLLOWERS,
  COMMUNITY_PILLAR_MIN_FOLLOWING,
  HELPFUL_REVIEWER_MIN_POSITIVE_REVIEWS,
  TRUSTED_SWAPPER_MIN_COMPLETED_TRADES,
} from "./constants"
import type {
  ContributorBadgeId,
  ContributorBadgeInputs,
  ContributorBadgesResult,
} from "./types"

const CONTRIBUTOR_BADGE_ORDER: ContributorBadgeId[] = [
  "trustedSwapper",
  "communityPillar",
  "rareCollector",
  "helpfulReviewer",
  "decantHost",
]

const collectContributorBadges = (
  input: ContributorBadgeInputs
): ContributorBadgeId[] => {
  const badges: ContributorBadgeId[] = []

  if (
    input.completedTradeCount >= TRUSTED_SWAPPER_MIN_COMPLETED_TRADES &&
    input.strikeCount === 0
  ) {
    badges.push("trustedSwapper")
  }

  if (
    input.followingUserCount >= COMMUNITY_PILLAR_MIN_FOLLOWING &&
    input.followerCount >= COMMUNITY_PILLAR_MIN_FOLLOWERS
  ) {
    badges.push("communityPillar")
  }

  if (input.qualifiesForRareCollector) {
    badges.push("rareCollector")
  }

  if (
    input.positiveHelpfulReviewCount >= HELPFUL_REVIEWER_MIN_POSITIVE_REVIEWS
  ) {
    badges.push("helpfulReviewer")
  }

  if (input.completedDecantSplitCount >= 1) {
    badges.push("decantHost")
  }

  return badges
}

const sortContributorBadges = (
  ids: ContributorBadgeId[]
): ContributorBadgeId[] => {
  const set = new Set(ids)
  return CONTRIBUTOR_BADGE_ORDER.filter((id) => set.has(id))
}

export const computeContributorBadges = (
  input: ContributorBadgeInputs
): ContributorBadgesResult => ({
  traderId: input.traderId,
  badges: sortContributorBadges(collectContributorBadges(input)),
})
