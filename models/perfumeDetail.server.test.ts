import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPerfumeRatings: vi.fn(),
  getUserPerfumeRating: vi.fn(),
  getPerfumeReviews: vi.fn(),
  getUserPerfumeReview: vi.fn(),
  getSeasonVoteAggregates: vi.fn(),
  getUserSeasonVote: vi.fn(),
  isInWishlist: vi.fn(),
  getSimilarPerfumes: vi.fn(),
}))

vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: () => Promise<unknown>) =>
    async () =>
      JSON.parse(JSON.stringify(await fn())),
}))

vi.mock("@/models/perfumeRating.server", () => ({
  getPerfumeRatings: mocks.getPerfumeRatings,
  getUserPerfumeRating: mocks.getUserPerfumeRating,
}))

vi.mock("@/models/perfumeReview.server", () => ({
  getPerfumeReviews: mocks.getPerfumeReviews,
  getUserPerfumeReview: mocks.getUserPerfumeReview,
}))

vi.mock("@/models/perfumeSeasonVote.server", () => ({
  getSeasonVoteAggregates: mocks.getSeasonVoteAggregates,
  getUserSeasonVote: mocks.getUserSeasonVote,
}))

vi.mock("@/models/wishlist.server", () => ({
  isInWishlist: mocks.isInWishlist,
}))

vi.mock("@/services/recommendations", () => ({
  rulesRecommendationService: { getSimilarPerfumes: mocks.getSimilarPerfumes },
}))

import {
  getPerfumeDetailPayload,
  getSimilarPerfumesForViewer,
} from "./perfumeDetail.server"

const createdAt = new Date("2026-01-02T03:04:05.000Z")
const updatedAt = new Date("2026-02-03T04:05:06.000Z")

describe("perfumeDetail.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPerfumeRatings.mockResolvedValue({
      userRatings: [
        { userId: "reviewer", overall: 4 },
        { userId: "rater-only", overall: 2 },
      ],
      averageRatings: { overall: 3, totalRatings: 2 },
    })
    mocks.getPerfumeReviews.mockResolvedValue({
      reviews: [{ id: "r1", userId: "reviewer", createdAt, updatedAt }],
      pagination: { page: 1, totalCount: 1 },
    })
    mocks.getSeasonVoteAggregates.mockResolvedValue({ totalVoters: 0 })
  })

  it("returns public data with Date fields restored after caching", async () => {
    const payload = await getPerfumeDetailPayload("p1", null, 5)

    const [review] = payload.reviewsData.reviews
    expect(review.createdAt).toBeInstanceOf(Date)
    expect(review.createdAt.getTime()).toBe(createdAt.getTime())
    expect(review.updatedAt.getTime()).toBe(updatedAt.getTime())
    expect(payload.reviewerOverallByUserId).toEqual({ reviewer: 4 })
    expect(payload.isInUserWishlist).toBe(false)
    expect(mocks.isInWishlist).not.toHaveBeenCalled()
  })

  it("loads viewer-specific data live when signed in", async () => {
    mocks.isInWishlist.mockResolvedValue(true)
    mocks.getUserPerfumeRating.mockResolvedValue({ overall: 5 })
    mocks.getUserPerfumeReview.mockResolvedValue(null)
    mocks.getUserSeasonVote.mockResolvedValue(null)

    const payload = await getPerfumeDetailPayload("p1", "viewer", 5)

    expect(mocks.isInWishlist).toHaveBeenCalledWith("viewer", "p1")
    expect(payload.isInUserWishlist).toBe(true)
    expect(payload.userRatings).toEqual({ overall: 5 })
  })

  it("only personalizes similar perfumes for signed-in viewers", async () => {
    mocks.getSimilarPerfumes.mockResolvedValue([])

    await getSimilarPerfumesForViewer("p1", 6, null)
    await getSimilarPerfumesForViewer("p1", 6, "viewer")

    expect(mocks.getSimilarPerfumes).toHaveBeenNthCalledWith(1, "p1", 6)
    expect(mocks.getSimilarPerfumes).toHaveBeenNthCalledWith(2, "p1", 6, {
      userId: "viewer",
    })
  })
})
