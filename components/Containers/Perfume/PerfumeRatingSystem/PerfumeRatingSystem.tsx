import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import NoirRating from "~/components/Organisms/NoirRating"
import { useRatingSystem } from "~/hooks"

interface PerfumeRatingSystemProps {
  perfumeId: string
  userId?: string | null
  userRatings?: {
    longevity?: number | null
    sillage?: number | null
    gender?: number | null
    priceValue?: number | null
    overall?: number | null
  } | null
  averageRatings?: {
    longevity?: number | null
    sillage?: number | null
    gender?: number | null
    priceValue?: number | null
    overall?: number | null
    totalRatings: number
  } | null
  readonly?: boolean
}

const PerfumeRatingSystem = ({
  perfumeId,
  userId,
  userRatings = null,
  averageRatings: initialAverageRatings = null,
  readonly = false,
}: PerfumeRatingSystemProps) => {
  const { t } = useTranslation()
  const [averageRatings, setAverageRatings] = useState(initialAverageRatings)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setAverageRatings(initialAverageRatings)
  }, [initialAverageRatings])

  const refreshAverageRatings = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const params = new URLSearchParams({ perfumeId })
      const response = await fetch(`/api/ratings?${params}`)

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.message || "Failed to refresh ratings")
      }

      const data = await response.json()
      setAverageRatings(data?.averageRatings ?? null)
    } catch (error) {
      console.error("Failed to refresh ratings", error)
    } finally {
      setIsRefreshing(false)
    }
  }, [perfumeId])

  const {
    currentRatings,
    isLoggedIn,
    isInteractive,
    handleRatingChange,
    categories,
  } = useRatingSystem({
    perfumeId,
    userId,
    initialRatings: userRatings,
    readonly,
    onSuccess: () => {
      void refreshAverageRatings()
    },
  })

  return (
    <div className="bg-noir-dark/20 rounded-lg p-6">
      <h2 className="text-xl font-bold text-noir-gold mb-1 text-center">
        {isInteractive
          ? t("singlePerfume.rating.RateThisPerfume")
          : t("singlePerfume.rating.CommunityRatings")}
      </h2>

      {!isLoggedIn && (
        <p className="text-sm text-noir-gold-500 mb-4 text-center">
          {t("singlePerfume.rating.loginToRate")}
        </p>
      )}

      <div className="space-y-6">
        {categories.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center">
            <h3 className="text-sm font-medium text-noir-gold mb-2">{label}</h3>
            <div className="flex flex-col items-center gap-2">
              <NoirRating
                category={key}
                value={currentRatings?.[key]}
                onChange={(rating: number) => handleRatingChange(key, rating)}
                readonly={false}
                showLabel
              />
              <div className="text-xs text-noir-gold-100 text-center">
                {averageRatings && averageRatings[key] ? (
                  <>
                    {t("singlePerfume.rating.communityAverage")}:{" "}
                    {averageRatings[key]?.toFixed(1)}/5
                    {averageRatings.totalRatings > 0 && (
                      <>
                        <span className="ml-1">
                          ({averageRatings.totalRatings}{" "}
                          {averageRatings.totalRatings === 1
                            ? t("singlePerfume.rating.vote")
                            : t("singlePerfume.rating.votes")}
                          )
                        </span>
                        {isRefreshing && <span className="ml-1">…</span>}
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-noir-gold-100">
                    {t("singlePerfume.rating.notYetRated")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading and error states are now handled by the useRatingSystem hook */}
    </div>
  )
}

export default PerfumeRatingSystem
