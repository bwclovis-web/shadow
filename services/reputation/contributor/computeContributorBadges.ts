import {
  COMMUNITY_PILLAR_MIN_FOLLOWERS,
  COMMUNITY_PILLAR_MIN_FOLLOWING,
  HELPFUL_REVIEWER_MIN_POSITIVE_REVIEWS,
  TRUSTED_SWAPPER_MIN_COMPLETED_TRADES,
} from "./constants"
import type {
  ContributorBadgeIdPhase1,
  ContributorBadgeInputs,
  ContributorBadgesResult,
} from "./types"

const CONTRIBUTOR_BADGE_ORDER: ContributorBadgeIdPhase1[] = [
  "trustedSwapper",
  "communityPillar",
  "rareCollector",
  "helpfulReviewer",
]

const collectContributorBadges = (
  input: ContributorBadgeInputs
): ContributorBadgeIdPhase1[] => {
  const badges: ContributorBadgeIdPhase1[] = []

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

  return badges
}

const sortContributorBadges = (
  ids: ContributorBadgeIdPhase1[]
): ContributorBadgeIdPhase1[] => {
  const set = new Set(ids)
  return CONTRIBUTOR_BADGE_ORDER.filter((id) => set.has(id))
}

export const computeContributorBadges = (
  input: ContributorBadgeInputs
): ContributorBadgesResult => ({
  traderId: input.traderId,
  badges: sortContributorBadges(collectContributorBadges(input)),
})
