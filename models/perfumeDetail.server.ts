/**
 * Consolidated perfume detail data for the perfume detail page (Fix #9).
 * Batches DB queries to reduce round-trips and avoid redundant parsing.
 */

import { unstable_cache } from "next/cache"

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
import {
  type RecommendationPerfume,
  rulesRecommendationService,
} from "@/services/recommendations"
import { perfumeCommunityCacheTag } from "@/utils/server/revalidate-catalog-cache.server"

const PERFUME_COMMUNITY_REVALIDATE_SECONDS = 600
const SIMILAR_PERFUMES_REVALIDATE_SECONDS = 86_400

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

type PerfumeCommunitySnapshot = {
  averageRatings: Awaited<
    ReturnType<typeof getPerfumeRatings>
  >["averageRatings"]
  reviewsData: Awaited<ReturnType<typeof getPerfumeReviews>>
  seasonAggregates: Awaited<ReturnType<typeof getSeasonVoteAggregates>>
  /** Overall rating per review author on the first review page (for JSON-LD). */
  reviewerOverallByUserId: Record<string, number | null>
}

const fetchPerfumeCommunitySnapshot = async (
  perfumeId: string,
  reviewPageSize: number
): Promise<PerfumeCommunitySnapshot> => {
  const [ratingsData, reviewsData, seasonAggregates] = await Promise.all([
    getPerfumeRatings(perfumeId),
    getPerfumeReviews(perfumeId, { isApproved: true }, {
      page: 1,
      limit: reviewPageSize,
    }),
    getSeasonVoteAggregates(perfumeId),
  ])

  const reviewerIds = new Set(reviewsData.reviews.map(review => review.userId))
  const reviewerOverallByUserId = Object.fromEntries(
    ratingsData.userRatings
      .filter(rating => reviewerIds.has(rating.userId))
      .map(rating => [rating.userId, rating.overall])
  )

  return {
    averageRatings: ratingsData.averageRatings,
    reviewsData,
    seasonAggregates,
    reviewerOverallByUserId,
  }
}

/** Public (same for every viewer) ratings, reviews, and season votes. */
const getPerfumeCommunitySnapshot = async (
  perfumeId: string,
  reviewPageSize: number
): Promise<PerfumeCommunitySnapshot> => {
  const snapshot = await unstable_cache(
    () => fetchPerfumeCommunitySnapshot(perfumeId, reviewPageSize),
    ["perfume-community", perfumeId, String(reviewPageSize)],
    {
      revalidate: PERFUME_COMMUNITY_REVALIDATE_SECONDS,
      tags: ["perfume", perfumeCommunityCacheTag(perfumeId)],
    }
  )()

  // unstable_cache stores JSON, so Date fields come back as strings.
  return {
    ...snapshot,
    reviewsData: {
      ...snapshot.reviewsData,
      reviews: snapshot.reviewsData.reviews.map(review => ({
        ...review,
        createdAt: new Date(review.createdAt),
        updatedAt: new Date(review.updatedAt),
      })),
    },
  }
}

export type PerfumeDetailPayload = PerfumeCommunitySnapshot & {
  isInUserWishlist: boolean
  userRatings: PerfumeDetailUserData["userRatings"]
  userReview: PerfumeDetailUserData["userReview"]
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
  const [community, userData] = await Promise.all([
    getPerfumeCommunitySnapshot(perfumeId, reviewPageSize),
    userId
      ? getPerfumeDetailUserData(userId, perfumeId)
      : Promise.resolve({
          isInUserWishlist: false,
          userRatings: null,
          userReview: null,
          userSeasonVote: null,
        } as PerfumeDetailUserData),
  ])

  return {
    ...community,
    isInUserWishlist: userData.isInUserWishlist,
    userRatings: userData.userRatings,
    userReview: userData.userReview,
    userSeasonVote: userData.userSeasonVote,
  }
}

/**
 * Signed-in viewers get live results that exclude perfumes they already own;
 * anonymous viewers (including crawlers) share one cached result per perfume.
 */
export const getSimilarPerfumesForViewer = (
  perfumeId: string,
  limit: number,
  viewerId: string | null
): Promise<RecommendationPerfume[]> =>
  viewerId
    ? rulesRecommendationService.getSimilarPerfumes(perfumeId, limit, {
        userId: viewerId,
      })
    : unstable_cache(
        () => rulesRecommendationService.getSimilarPerfumes(perfumeId, limit),
        ["perfume-similar", perfumeId, String(limit)],
        {
          revalidate: SIMILAR_PERFUMES_REVALIDATE_SECONDS,
          tags: ["perfume"],
        }
      )()
