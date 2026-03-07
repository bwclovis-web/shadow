import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys as perfumeQueryKeys } from "@/lib/queries/perfumes"
import { queryKeys, type WishlistResponse as WishlistCache } from "@/lib/queries/user"

export interface WishlistActionParams {
  perfumeId: string
  action: "add" | "remove" | "updateVisibility"
  isPublic?: boolean
}

export interface WishlistResponse {
  success: boolean
  message?: string
  data?: unknown
  error?: string
}

type WishlistItem = { perfumeId?: string; perfume?: { id: string } }

const isInWishlist = (items: WishlistItem[], perfumeId: string) =>
  items.some(
    item => item.perfumeId === perfumeId || item.perfume?.id === perfumeId
  )

const getCsrfHeader = (): HeadersInit => {
  if (typeof document === "undefined") return {}
  const cookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("_csrf="))
  const token = cookie ? cookie.split("=")[1]?.trim() : null
  return token ? { "x-csrf-token": token } : {}
}

const wishlistAction = async (
  params: WishlistActionParams
): Promise<WishlistResponse> => {
  const { perfumeId, action, isPublic } = params

  const formData = new FormData()
  formData.append("perfumeId", perfumeId)
  formData.append("action", action)
  if (isPublic !== undefined) {
    formData.append("isPublic", String(isPublic))
  }

  const response = await fetch("/api/wishlist", {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: getCsrfHeader(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as {
      error?: string
      message?: string
    }
    throw new Error(
      errorData.error ?? errorData.message ?? `Failed to ${action} from wishlist`
    )
  }

  return response.json()
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
export const useToggleWishlist = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: wishlistAction,
    onMutate: async variables => {
      const { perfumeId, action } = variables
      const wishlistKey = queryKeys.user.wishlist("current")
      const perfumeKey = perfumeQueryKeys.perfumes.detail(perfumeId)

      await Promise.all([
        queryClient.cancelQueries({ queryKey: wishlistKey }),
        queryClient.cancelQueries({ queryKey: perfumeKey }),
      ])

      const previousWishlist = queryClient.getQueryData(wishlistKey)
      const previousPerfume = queryClient.getQueryData(perfumeKey)

      if (action === "add" || action === "remove") {
        queryClient.setQueryData(wishlistKey, (old: WishlistCache | undefined) => {
          if (!old) return old

          const items = old.wishlist ?? []
          if (action === "add") {
            if (isInWishlist(items, perfumeId)) return old
            return {
              ...old,
              wishlist: [...items, { perfumeId, perfume: { id: perfumeId } }],
            }
          }
          return {
            ...old,
            wishlist: items.filter(
              item =>
                item.perfumeId !== perfumeId && item.perfume?.id !== perfumeId
            ),
          }
        })
      }

      return { previousWishlist, previousPerfume }
    },
    onError: (_error, variables, context) => {
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.wishlist("current"),
        exact: false,
      })
      queryClient.invalidateQueries({
        queryKey: perfumeQueryKeys.perfumes.detail(variables.perfumeId),
        exact: true,
      })
    },
  })
}

