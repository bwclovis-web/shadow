import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys as perfumeQueryKeys } from "~/lib/queries/perfumes"
import { queryKeys } from "~/lib/queries/user"

export interface WishlistActionParams {
  perfumeId: string
  action: "add" | "remove" | "updateVisibility"
  isPublic?: boolean
}

export interface WishlistResponse {
  success: boolean
  message?: string
  data?: any
  error?: string
}

/**
 * Mutation function to perform wishlist actions (add, remove, updateVisibility).
 */
async function wishlistAction(params: WishlistActionParams): Promise<WishlistResponse> {
  const { perfumeId, action, isPublic } = params

  const formData = new FormData()
  formData.append("perfumeId", perfumeId)
  formData.append("action", action)
  if (isPublic !== undefined) {
    formData.append("isPublic", isPublic.toString())
  }

  const response = await fetch("/api/wishlist", {
    method: "POST",
    body: formData,
    credentials: "include",
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || `Failed to ${action} from wishlist`)
  }

  return await response.json()
}

/**
 * Hook to toggle wishlist status (add/remove) with optimistic updates.
 * 
 * @example
 * ```tsx
 * const toggleWishlist = useToggleWishlist()
 * 
 * // Add to wishlist
 * toggleWishlist.mutate({ perfumeId: "123", action: "add", isPublic: false })
 * 
 * // Remove from wishlist
 * toggleWishlist.mutate({ perfumeId: "123", action: "remove" })
 * ```
 */
export function useToggleWishlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: wishlistAction,
    onMutate: async variables => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      const { perfumeId } = variables

      // Cancel any outgoing refetches for wishlist and perfume queries
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.user.wishlist("current") }),
        queryClient.cancelQueries({
          queryKey: perfumeQueryKeys.perfumes.detail(perfumeId),
        }),
      ])

      // Snapshot previous values for rollback
      const previousWishlist = queryClient.getQueryData(queryKeys.user.wishlist("current"))
      const previousPerfume = queryClient.getQueryData(perfumeQueryKeys.perfumes.detail(perfumeId))

      // Optimistically update wishlist
      if (variables.action === "add" || variables.action === "remove") {
        queryClient.setQueryData(
          queryKeys.user.wishlist("current"),
          (old: any) => {
            if (!old) {
 return old 
}

            const wishlistItems = old.wishlist || []
            const isAdding = variables.action === "add"

            if (isAdding) {
              // Add to wishlist (optimistic)
              if (
                !wishlistItems.some((item: any) => item.perfumeId === perfumeId || item.perfume?.id === perfumeId)
              ) {
                return {
                  ...old,
                  wishlist: [
                    ...wishlistItems,
                    { perfumeId, perfume: { id: perfumeId } },
                  ],
                }
              }
            } else {
              // Remove from wishlist (optimistic)
              return {
                ...old,
                wishlist: wishlistItems.filter((item: any) => item.perfumeId !== perfumeId &&
                    item.perfume?.id !== perfumeId),
              }
            }

            return old
          }
        )
      }

      return { previousWishlist, previousPerfume }
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousWishlist) {
        queryClient.setQueryData(
          queryKeys.user.wishlist("current"),
          context.previousWishlist
        )
      }
      if (context?.previousPerfume) {
        queryClient.setQueryData(
          perfumeQueryKeys.perfumes.detail(variables.perfumeId),
          context.previousPerfume
        )
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to refetch fresh data
      const { perfumeId } = variables

      // Invalidate only wishlist queries (not all user data)
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.wishlist("current"),
        exact: false, // Also invalidates nested keys
      })

      // Invalidate specific perfume detail query
      queryClient.invalidateQueries({
        queryKey: perfumeQueryKeys.perfumes.detail(perfumeId),
        exact: true, // Only this specific perfume
      })

      // Don't invalidate all perfume lists - too broad and causes unnecessary refetches
      // If perfume lists need wishlist status, they should include it in their response
      // or use a separate query to check wishlist status
    },
  })
}

