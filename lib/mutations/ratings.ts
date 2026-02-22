import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys as perfumeQueryKeys } from "@/lib/queries/perfumes"
import { queryKeys } from "@/lib/queries/reviews"

export type RatingCategory =
  | "longevity"
  | "sillage"
  | "gender"
  | "priceValue"
  | "overall"

export interface CreateOrUpdateRatingParams {
  perfumeId: string
  category: RatingCategory
  rating: number // 1-5
}

export interface RatingResponse {
  success: boolean
  message?: string
  data?: any
  error?: string
}

const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null
  const csrfCookie = document.cookie
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("_csrf="))
  return csrfCookie ? decodeURIComponent(csrfCookie.split("=")[1]) : null
}

const applyOptimisticAverage = (
  old: { averageRatings?: Record<string, number | undefined> & { totalRatings?: number } },
  category: RatingCategory,
  rating: number
) => {
  const currentAverage = old.averageRatings?.[category] ?? 0
  const currentTotal = old.averageRatings?.totalRatings ?? 0
  const newAverage =
    currentTotal > 0 ? (currentAverage * currentTotal + rating) / (currentTotal + 1) : rating
  return {
    ...old.averageRatings,
    [category]: newAverage,
    totalRatings: currentTotal + 1,
  }
}

/**
 * Create or update a rating mutation function.
 * The API endpoint handles both create and update.
 */
const saveRating = async (params: CreateOrUpdateRatingParams): Promise<RatingResponse> => {
  const { perfumeId, category, rating } = params
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5")

  const csrfToken = getCsrfToken()
  const formData = new FormData()
  formData.append("perfumeId", perfumeId)
  formData.append("category", category)
  formData.append("rating", rating.toString())
  if (csrfToken) formData.append("_csrf", csrfToken)

  const response = await fetch("/api/ratings", {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || "Failed to save rating")
  }
  return response.json()
}

/**
 * Hook to create or update a rating with optimistic average updates.
 * This single hook handles both create and update since the API endpoint does both.
 * 
 * @example
 * ```tsx
 * const saveRating = useCreateOrUpdateRating()
 * saveRating.mutate({ perfumeId: "123", category: "overall", rating: 5 })
 * ```
 */
export const useCreateOrUpdateRating = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveRating,
    onMutate: async variables => {
      const { perfumeId, category, rating } = variables
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.ratings.byPerfume(perfumeId) }),
        queryClient.cancelQueries({ queryKey: perfumeQueryKeys.perfumes.detail(perfumeId) }),
      ])

      const previousRatings = queryClient.getQueryData(queryKeys.ratings.byPerfume(perfumeId))
      const previousPerfume = queryClient.getQueryData(perfumeQueryKeys.perfumes.detail(perfumeId))

      queryClient.setQueryData(queryKeys.ratings.byPerfume(perfumeId), (old: any) => {
        if (!old) return old
        return { ...old, averageRatings: applyOptimisticAverage(old, category, rating) }
      })

      queryClient.setQueryData(perfumeQueryKeys.perfumes.detail(perfumeId), (old: any) => {
        if (!old?.averageRatings) return old
        return { ...old, averageRatings: applyOptimisticAverage(old, category, rating) }
      })

      return { previousRatings, previousPerfume }
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousRatings) {
        queryClient.setQueryData(
          queryKeys.ratings.byPerfume(variables.perfumeId),
          context.previousRatings
        )
      }
      if (context?.previousPerfume) {
        queryClient.setQueryData(
          perfumeQueryKeys.perfumes.detail(variables.perfumeId),
          context.previousPerfume
        )
      }
    },
    onSuccess: (_data, { perfumeId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ratings.byPerfume(perfumeId),
        exact: true,
      })
      queryClient.invalidateQueries({
        queryKey: perfumeQueryKeys.perfumes.detail(perfumeId),
        exact: true,
      })
    },
  })
}

// Alias for convenience (matching the checklist naming)
export const useCreateRating = useCreateOrUpdateRating
export const useUpdateRating = useCreateOrUpdateRating

