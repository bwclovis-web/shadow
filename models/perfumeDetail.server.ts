/**
 * Consolidated perfume detail data for the perfume detail page (Fix #9).
 * Batches DB queries to reduce round-trips and avoid redundant parsing.
 */

import {
  getPerfumeRatings,
  getUserPerfumeRating,
} from "@/models/perfumeRating.server"
import {
  getPerfumeReviews,
  getUserPerfumeReview,
} from "@/models/perfumeReview.server"
import {
  getSeasonVoteAggregates,
  getUserSeasonVote,
} from "@/models/perfumeSeasonVote.server"
import { isInWishlist } from "@/models/wishlist.server"

export type PerfumeDetailUserData = {
  isInUserWishlist: boolean
  userRatings: Awaited<ReturnType<typeof getUserPerfumeRating>>
  userReview: Awaited<ReturnType<typeof getUserPerfumeReview>>
  userSeasonVote: Awaited<ReturnType<typeof getUserSeasonVote>>
}

/**
 * Fetch all user-specific data for a perfume in one parallel batch (wishlist, rating, review).
 * Reduces three separate call sites to one and keeps one place to add raw-query optimization later.
 */
export async function getPerfumeDetailUserData(
  userId: string,
  perfumeId: string
): Promise<PerfumeDetailUserData> {
  const [isInUserWishlist, userRatings, userReview, userSeasonVote] = await Promise.all([
    isInWishlist(userId, perfumeId),
    getUserPerfumeRating(userId, perfumeId).catch(() => null),
    getUserPerfumeReview(userId, perfumeId),
    getUserSeasonVote(userId, perfumeId).catch(() => null),
  ])
  return { isInUserWishlist, userRatings, userReview, userSeasonVote }
}

export type PerfumeDetailPayload = {
  averageRatings: Awaited<
    ReturnType<typeof getPerfumeRatings>
  >["averageRatings"]
  reviewsData: Awaited<ReturnType<typeof getPerfumeReviews>>
  isInUserWishlist: boolean
  userRatings: PerfumeDetailUserData["userRatings"]
  userReview: PerfumeDetailUserData["userReview"]
  seasonAggregates: Awaited<ReturnType<typeof getSeasonVoteAggregates>>
  userSeasonVote: PerfumeDetailUserData["userSeasonVote"]
}

/**
 * Load ratings, first page of reviews, and (when logged in) wishlist + user rating + user review
 * in one parallel batch. Call once per perfume detail load.
 */
export async function getPerfumeDetailPayload(
  perfumeId: string,
  userId: string | null,
  reviewPageSize: number
): Promise<PerfumeDetailPayload> {
  const [ratingsData, reviewsData, userData, seasonAggregates] = await Promise.all([
    getPerfumeRatings(perfumeId),
    getPerfumeReviews(perfumeId, { isApproved: true }, {
      page: 1,
      limit: reviewPageSize,
    }),
    userId
      ? getPerfumeDetailUserData(userId, perfumeId)
      : Promise.resolve({
          isInUserWishlist: false,
          userRatings: null,
          userReview: null,
          userSeasonVote: null,
        } as PerfumeDetailUserData),
    getSeasonVoteAggregates(perfumeId),
  ])

  return {
    averageRatings: ratingsData.averageRatings,
    reviewsData,
    isInUserWishlist: userData.isInUserWishlist,
    userRatings: userData.userRatings,
    userReview: userData.userReview,
    seasonAggregates,
    userSeasonVote: userData.userSeasonVote,
  }
}
