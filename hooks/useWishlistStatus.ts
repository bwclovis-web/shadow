import { useQuery } from "@tanstack/react-query"

import { getWishlist, queryKeys } from "~/lib/queries/user"

/**
 * Hook to check if a perfume is in the user's wishlist.
 * 
 * Note: This queries the full wishlist and checks if the perfume is present.
 * For better performance, consider creating a dedicated endpoint `/api/wishlist/status?perfumeId={id}`.
 * 
 * @param perfumeId - Perfume ID
 * @param userId - User ID (required for querying wishlist)
 * @returns Query result with wishlist status (boolean)
 * 
 * @example
 * ```tsx
 * const { data: isInWishlist, isLoading } = useWishlistStatus(perfumeId, userId)
 * ```
 */
export function useWishlistStatus(perfumeId: string, userId: string) {
  return useQuery({
    queryKey: [...queryKeys.user.wishlist(userId), "status", perfumeId],
    queryFn: async () => {
      if (!userId || !perfumeId) {
        return false
      }

      // Query the full wishlist and check if perfume is in it
      const wishlistData = await getWishlist(userId)
      const wishlistItems = wishlistData.wishlist || []

      // Check if perfume exists in wishlist
      return wishlistItems.some((item: any) => item.perfumeId === perfumeId || item.perfume?.id === perfumeId)
    },
    enabled: !!perfumeId && !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute (wishlist status can change)
    // Use cached wishlist data if available
    select: data => data ?? false,
  })
}

