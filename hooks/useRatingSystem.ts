import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { useCreateOrUpdateRating } from "~/lib/mutations/ratings"

import { useErrorHandler } from "./useErrorHandler"

export interface RatingData {
  longevity?: number | null
  sillage?: number | null
  gender?: number | null
  priceValue?: number | null
  overall?: number | null
}

export interface UseRatingSystemOptions {
  perfumeId: string
  userId?: string | null
  initialRatings?: RatingData | null
  readonly?: boolean
  onError?: (error: string) => void
  onSuccess?: (ratings: RatingData) => void
}

export interface UseRatingSystemReturn {
  currentRatings: RatingData | null
  isLoggedIn: boolean
  isInteractive: boolean
  isSubmitting: boolean
  handleRatingChange: (category: keyof RatingData, rating: number) => void
  resetRatings: () => void
  categories: Array<{ key: keyof RatingData; label: string }>
}

/**
 * Custom hook for managing rating system state and interactions
 *
 * @param options - Configuration options for the rating system
 * @returns Rating system state and handlers
 */
export const useRatingSystem = ({
  perfumeId,
  userId,
  initialRatings = null,
  readonly = false,
  onError,
  onSuccess,
}: UseRatingSystemOptions): UseRatingSystemReturn => {
  const { t } = useTranslation()
  const { handleError } = useErrorHandler()

  const [currentRatings, setCurrentRatings] = useState<RatingData | null>(initialRatings)
  
  // Use TanStack Query mutation for ratings
  const saveRating = useCreateOrUpdateRating()

  const isLoggedIn = Boolean(userId) && userId !== "anonymous"
  const isInteractive = isLoggedIn && !readonly

  // Update ratings when initial ratings change
  useEffect(() => {
    setCurrentRatings(initialRatings)
  }, [initialRatings])

  const handleRatingChange = useCallback(
    async (category: keyof RatingData, rating: number) => {
      if (!isInteractive || !userId || userId === "anonymous") {
        return
      }

      // Optimistic update - update local state immediately
      const previousRatings = currentRatings
      setCurrentRatings(prev => ({
        ...prev,
        [category]: rating,
      }))

      // Use mutation with optimistic average updates
      saveRating.mutate(
        {
          perfumeId,
          category: category as any,
          rating,
        },
        {
          onSuccess: () => {
            onSuccess?.({ ...previousRatings, [category]: rating } as RatingData)
          },
          onError: error => {
            // Revert on error
            setCurrentRatings(previousRatings)
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Failed to save rating"
            onError?.(errorMessage)
            handleError(error instanceof Error ? error : new Error(errorMessage), {
              context: { perfumeId, userId, category, rating },
            })
          },
        }
      )
    },
    [
      isInteractive,
      userId,
      perfumeId,
      currentRatings,
      saveRating,
      onError,
      onSuccess,
      handleError,
    ]
  )

  const resetRatings = useCallback(() => {
    setCurrentRatings(initialRatings)
  }, [initialRatings])

  const categories: Array<{ key: keyof RatingData; label: string }> = [
    { key: "longevity", label: t("singlePerfume.rating.categories.longevity") },
    { key: "sillage", label: t("singlePerfume.rating.categories.sillage") },
    { key: "gender", label: t("singlePerfume.rating.categories.gender") },
    {
      key: "priceValue",
      label: t("singlePerfume.rating.categories.priceValue"),
    },
    { key: "overall", label: t("singlePerfume.rating.categories.overall") },
  ]

  return {
    currentRatings,
    isLoggedIn,
    isInteractive,
    isSubmitting: saveRating.isPending,
    handleRatingChange,
    resetRatings,
    categories,
  }
}

export default useRatingSystem
