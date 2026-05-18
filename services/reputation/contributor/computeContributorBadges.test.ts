import { describe, expect, it } from "vitest"

import { computeContributorBadges } from "./computeContributorBadges"
import type { ContributorBadgeInputs } from "./types"

const base = (
  overrides: Partial<ContributorBadgeInputs> = {}
): ContributorBadgeInputs => ({
  traderId: "t1",
  completedTradeCount: 0,
  strikeCount: 0,
  followerCount: 0,
  followingUserCount: 0,
  qualifiesForRareCollector: false,
  positiveHelpfulReviewCount: 0,
  ...overrides,
})

describe("computeContributorBadges", () => {
  it("returns no badges for empty inputs", () => {
    expect(computeContributorBadges(base()).badges).toEqual([])
  })

  it("awards trustedSwapper at 5+ completed trades with no strikes", () => {
    const r = computeContributorBadges(
      base({ completedTradeCount: 5, strikeCount: 0 })
    )
    expect(r.badges).toContain("trustedSwapper")
  })

  it("does not award trustedSwapper when strikes exist", () => {
    const r = computeContributorBadges(
      base({ completedTradeCount: 10, strikeCount: 1 })
    )
    expect(r.badges).not.toContain("trustedSwapper")
  })

  it("does not award trustedSwapper below trade threshold", () => {
    const r = computeContributorBadges(
      base({ completedTradeCount: 4, strikeCount: 0 })
    )
    expect(r.badges).not.toContain("trustedSwapper")
  })

  it("awards communityPillar when following and followers meet threshold", () => {
    const r = computeContributorBadges(
      base({ followerCount: 10, followingUserCount: 10 })
    )
    expect(r.badges).toContain("communityPillar")
  })

  it("does not award communityPillar when only one side meets threshold", () => {
    const r = computeContributorBadges(
      base({ followerCount: 10, followingUserCount: 9 })
    )
    expect(r.badges).not.toContain("communityPillar")
  })

  it("awards rareCollector when niche qualification is true", () => {
    const r = computeContributorBadges(
      base({ qualifiesForRareCollector: true })
    )
    expect(r.badges).toContain("rareCollector")
  })

  it("awards helpfulReviewer at 3+ positive helpful reviews", () => {
    const r = computeContributorBadges(
      base({ positiveHelpfulReviewCount: 3 })
    )
    expect(r.badges).toContain("helpfulReviewer")
  })

  it("does not award helpfulReviewer below threshold", () => {
    const r = computeContributorBadges(
      base({ positiveHelpfulReviewCount: 2 })
    )
    expect(r.badges).not.toContain("helpfulReviewer")
  })

  it("sorts badges in display order", () => {
    const r = computeContributorBadges(
      base({
        completedTradeCount: 5,
        followerCount: 10,
        followingUserCount: 10,
        qualifiesForRareCollector: true,
        positiveHelpfulReviewCount: 3,
      })
    )
    expect(r.badges).toEqual([
      "trustedSwapper",
      "communityPillar",
      "rareCollector",
      "helpfulReviewer",
    ])
  })
})
