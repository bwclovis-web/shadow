import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { type RatingCategory, useCreateOrUpdateRating } from "@/lib/mutations/ratings"

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
  const t = useTranslations("singlePerfume.rating.categories")
  const { handleError } = useErrorHandler()

  const [currentRatings, setCurrentRatings] = useState<RatingData | null>(initialRatings)
  const ratingsRef = useRef(currentRatings)

  useEffect(() => {
    ratingsRef.current = currentRatings
  }, [currentRatings])

  const saveRating = useCreateOrUpdateRating()

  const isLoggedIn = Boolean(userId) && userId !== "anonymous"
  const isInteractive = isLoggedIn && !readonly

  useEffect(() => {
    setCurrentRatings(initialRatings)
  }, [initialRatings])

  const handleRatingChange = useCallback(
    (category: keyof RatingData, rating: number) => {
      if (!isInteractive || !userId || userId === "anonymous") {
        return
      }

      const previousRatings = ratingsRef.current
      setCurrentRatings(prev => ({
        ...prev,
        [category]: rating,
      }))

      saveRating.mutate(
        {
          perfumeId,
          category: category as RatingCategory,
          rating,
        },
        {
          onSuccess: () => {
            onSuccess?.({ ...previousRatings, [category]: rating } as RatingData)
          },
          onError: error => {
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
    [isInteractive, userId, perfumeId, saveRating, onError, onSuccess, handleError]
  )

  const resetRatings = useCallback(() => {
    setCurrentRatings(initialRatings)
  }, [initialRatings])

  const categories: Array<{ key: keyof RatingData; label: string }> = [
    { key: "longevity", label: t("longevity") },
    { key: "sillage", label: t("sillage") },
    { key: "gender", label: t("gender") },
    {
      key: "priceValue",
      label: t("priceValue"),
    },
    { key: "overall", label: t("overall") },
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
