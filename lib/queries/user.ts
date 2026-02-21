/**
 * Query functions and query keys for User Data
 * 
 * This module provides query functions for fetching user-specific data from the API
 * and query key factories for TanStack Query cache management.
 */

export interface UserPerfumeFilters {
  available?: boolean // Filter by availability
}

export interface UserAlertsResponse {
  alerts: any[]
  unreadCount: number
}

export interface UserPerfumesResponse {
  success: boolean
  userPerfumes: any[]
  allPerfumes?: any[] // Optional: all perfumes list
}

export interface WishlistResponse {
  wishlist: any[]
  count?: number
}

/**
 * Query key factory for user data queries.
 * Uses hierarchical structure for easy invalidation.
 */
export const queryKeys = {
  user: {
    all: ["user"] as const,
    perfumes: (userId: string, filters?: UserPerfumeFilters) => [
...queryKeys.user.all, "perfumes", userId, filters
] as const,
    wishlist: (userId: string) => [...queryKeys.user.all, "wishlist", userId] as const,
    alerts: (userId: string) => [...queryKeys.user.all, "alerts", userId] as const,
    trader: (traderId: string) => [...queryKeys.user.all, "trader", traderId] as const,
  },
} as const

/**
 * Fetch user's perfumes (perfumes they own/are trading).
 * Requires authentication.
 * 
 * @param userId - User ID
 * @param filters - Optional filter options
 * @returns Promise resolving to user perfumes response
 */
export async function getUserPerfumes(
  userId: string,
  filters: UserPerfumeFilters = {}
): Promise<UserPerfumesResponse> {
  if (!userId) {
    throw new Error("User ID is required")
  }

  const params = new URLSearchParams()

  // Add filters if provided
  if (filters.available !== undefined) {
    params.append("available", filters.available.toString())
  }

  const queryString = params.toString()
  const url = queryString
    ? `/api/user-perfumes?${queryString}`
    : "/api/user-perfumes"

  const response = await fetch(url, {
    credentials: "include", // Include cookies for authentication
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error ||
        errorData.message ||
        `Failed to fetch user perfumes: ${response.statusText}`)
  }

  const data: UserPerfumesResponse = await response.json()

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch user perfumes")
  }

  return data
}

/**
 * Fetch user's wishlist.
 * 
 * Note: Currently, wishlist only has a POST endpoint for actions.
 * This function assumes a GET endpoint exists at `/api/wishlist?userId={userId}`.
 * If it doesn't exist, you may need to create it or update this function.
 * 
 * @param userId - User ID
 * @returns Promise resolving to wishlist response
 */
export async function getWishlist(userId: string): Promise<WishlistResponse> {
  if (!userId) {
    throw new Error("User ID is required")
  }

  // Note: This endpoint may need to be created if it doesn't exist
  // Currently, wishlist only has POST endpoints for add/remove actions
  // If a GET endpoint exists, use: `/api/wishlist?userId=${userId}`
  // Otherwise, this will need to be implemented as an API route
  const params = new URLSearchParams({
    userId,
  })

  const response = await fetch(`/api/wishlist?${params}`, {
    credentials: "include", // Include cookies for authentication
  })

  if (response.status === 404) {
    // Wishlist might not exist yet - return empty array
    return { wishlist: [], count: 0 }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error ||
        errorData.message ||
        `Failed to fetch wishlist: ${response.statusText}`)
  }

  const data: WishlistResponse = await response.json()

  return data
}

/**
 * Fetch user's alerts (notifications).
 * Requires authentication - users can only access their own alerts.
 * 
 * @param userId - User ID
 * @returns Promise resolving to alerts response with unread count
 */
export async function getUserAlerts(userId: string): Promise<UserAlertsResponse> {
  if (!userId) {
    throw new Error("User ID is required")
  }

  const response = await fetch(`/api/user-alerts/${userId}`, {
    credentials: "include", // Include cookies for authentication
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Forbidden: You can only access your own alerts")
    }

    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error ||
        errorData.message ||
        `Failed to fetch user alerts: ${response.statusText}`)
  }

  const data: UserAlertsResponse = await response.json()

  // API may return empty defaults if tables don't exist
  return {
    alerts: data.alerts || [],
    unreadCount: data.unreadCount || 0,
  }
}

/**
 * Trader (user) profile interface.
 * Represents a trader with their perfumes and wishlist.
 */
export interface TraderResponse {
  id: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  email: string
  UserPerfume?: any[]
  UserPerfumeWishlist?: any[]
  [key: string]: any // Allow for additional trader properties
}

/**
 * Fetch trader (user) profile by ID.
 * 
 * Note: This assumes a GET endpoint exists at `/api/trader/${traderId}`.
 * If it doesn't exist, you may need to create it or update this function.
 * 
 * @param traderId - Trader/User ID
 * @returns Promise resolving to trader profile data
 */
export async function getTraderById(traderId: string): Promise<TraderResponse> {
  if (!traderId) {
    throw new Error("Trader ID is required")
  }

  // Note: This endpoint may need to be created if it doesn't exist
  // For now, we'll use a pattern that matches the server loader
  // If an API endpoint exists, use: `/api/trader/${traderId}`
  // Otherwise, this will need to be implemented as an API route
  const response = await fetch(`/api/trader/${traderId}`, {
    credentials: "include",
  })

  if (response.status === 404) {
    throw new Error("Trader not found")
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error ||
        errorData.message ||
        `Failed to fetch trader: ${response.statusText}`)
  }

  const data = await response.json()

  return data.trader || data
}

