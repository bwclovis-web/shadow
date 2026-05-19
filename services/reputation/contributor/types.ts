/** Contributor badges. See docs/contributor-badges-spec.md */
export type ContributorBadgeId =
  | "trustedSwapper"
  | "communityPillar"
  | "rareCollector"
  | "helpfulReviewer"
  /** Deferred: requires D3 decant splits */
  | "decantHost"

/** Badges awarded in Phase 1 (excludes deferred decantHost) */
export type ContributorBadgeIdPhase1 = Exclude<ContributorBadgeId, "decantHost">

export interface ContributorBadgeInputs {
  traderId: string
  completedTradeCount: number
  strikeCount: number
  followerCount: number
  followingUserCount: number
  qualifiesForRareCollector: boolean
  positiveHelpfulReviewCount: number
  completedDecantSplitCount: number
}

export interface ContributorBadgesResult {
  traderId: string
  badges: ContributorBadgeId[]
}
