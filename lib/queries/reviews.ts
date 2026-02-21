/**
 * Query functions and query keys for Reviews and Ratings
 * 
 * This module provides query functions for fetching reviews and ratings data from the API
 * and query key factories for TanStack Query cache management.
 */

export interface ReviewFilters {
  perfumeId?: string
  userId?: string
  isApproved?: boolean
}

export interface ReviewPagination {
  page?: number
  limit?: number
}

export interface ReviewsResponse {
  reviews: any[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface RatingsResponse {
  userRatings: any[]
  averageRatings: {
    longevity: number | null
    sillage: number | null
    gender: number | null
    priceValue: number | null
    overall: number | null
    totalRatings: number
  }
}

/**
 * Query key factory for reviews queries.
 * Uses hierarchical structure for easy invalidation.
 */
export const queryKeys = {
  reviews: {
    all: ["reviews"] as const,
    lists: () => [...queryKeys.reviews.all, "list"] as const,
    list: (filters: ReviewFilters, pagination?: ReviewPagination) => [...queryKeys.reviews.lists(), filters, pagination] as const,
    byPerfume: (perfumeId: string, pagination?: ReviewPagination) => [
...queryKeys.reviews.all, "perfume", perfumeId, pagination
] as const,
    byUser: (userId: string, pagination?: ReviewPagination) => [
...queryKeys.reviews.all, "user", userId, pagination
] as const,
    userReviews: (pagination?: ReviewPagination) => [...queryKeys.reviews.all, "userReviews", pagination] as const,
    pending: (pagination?: ReviewPagination) => [...queryKeys.reviews.all, "pending", pagination] as const,
  },
  ratings: {
    all: ["ratings"] as const,
    byPerfume: (perfumeId: string) => [...queryKeys.ratings.all, "perfume", perfumeId] as const,
    userRating: (userId: string, perfumeId: string) => [
...queryKeys.ratings.all, "user", userId, perfumeId
] as const,
  },
} as const

/**
 * Fetch reviews with optional filters and pagination.
 * 
 * @param filters - Filter options (perfumeId, userId, isApproved)
 * @param pagination - Pagination options (page, limit)
 * @returns Promise resolving to reviews response with pagination
 */
export async function getReviews(
  filters: ReviewFilters = {},
  pagination: ReviewPagination = {}
): Promise<ReviewsResponse> {
  const { perfumeId, userId, isApproved } = filters
  const { page = 1, limit = 10 } = pagination

  if (!perfumeId && !userId) {
    throw new Error("Either perfumeId or userId is required")
  }

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })

  if (perfumeId) {
    params.append("perfumeId", perfumeId)
  }
  if (userId) {
    params.append("userId", userId)
  }
  if (isApproved !== undefined) {
    params.append("isApproved", isApproved.toString())
  }

  const response = await fetch(`/api/reviews?${params}`)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to fetch reviews: ${response.statusText}`)
  }

  const data: ReviewsResponse = await response.json()

  return data
}

/**
 * Fetch reviews for a specific user.
 * Requires authentication.
 * 
 * @param userId - User ID
 * @param filters - Additional filter options
 * @param pagination - Pagination options (page, limit)
 * @returns Promise resolving to reviews response with pagination
 */
export async function getUserReviews(
  userId: string,
  filters: ReviewFilters = {},
  pagination: ReviewPagination = {}
): Promise<ReviewsResponse> {
  if (!userId) {
    throw new Error("User ID is required")
  }

  return getReviews({ ...filters, userId }, pagination)
}

/**
 * Fetch ratings for a specific perfume.
 * 
 * Note: Currently loaded via server loader. This function may need an API endpoint
 * if client-side fetching is required. For now, it assumes `/api/ratings?perfumeId={id}` exists.
 * 
 * @param perfumeId - Perfume ID
 * @returns Promise resolving to ratings response with averages
 */
export async function getRatings(perfumeId: string): Promise<RatingsResponse> {
  if (!perfumeId) {
    throw new Error("Perfume ID is required")
  }

  // Note: This endpoint may need to be created if it doesn't exist
  // For now, we'll use a pattern that matches the server function
  // If an API endpoint exists, use: `/api/ratings?perfumeId=${perfumeId}`
  // Otherwise, this will need to be implemented as a GET endpoint
  const params = new URLSearchParams({
    perfumeId,
  })

  const response = await fetch(`/api/ratings?${params}`)

  if (response.status === 404) {
    throw new Error("Ratings not found")
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to fetch ratings: ${response.statusText}`)
  }

  const data: RatingsResponse = await response.json()

  return data
}

