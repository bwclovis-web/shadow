import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import NoirRating from "@/components/Organisms/NoirRating"
import { useRatingSystem } from "@/hooks"
import type {
  PerfumeDetailAverageRatingsProp,
  PerfumeDetailUserRatingsProp,
} from "@/components/Containers/Perfume/perfume-detail-types"

interface PerfumeRatingSystemProps {
  perfumeId: string
  userId?: string | null
  userRatings?: PerfumeDetailUserRatingsProp
  averageRatings?: PerfumeDetailAverageRatingsProp
  readonly?: boolean
}

const PerfumeRatingSystem = ({
  perfumeId,
  userId,
  userRatings = null,
  averageRatings: initialAverageRatings = null,
  readonly = false,
}: PerfumeRatingSystemProps) => {
  const t = useTranslations("singlePerfume.rating")
  const [averageRatings, setAverageRatings] = useState(initialAverageRatings)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setAverageRatings(initialAverageRatings)
  }, [initialAverageRatings])

  const refreshAverageRatings = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch(`/api/ratings?${new URLSearchParams({ perfumeId })}`)
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error((errorPayload as { message?: string }).message ?? "Failed to refresh ratings")
      }
      const data = (await response.json()) as {
        averageRatings?: PerfumeDetailAverageRatingsProp
      }
      setAverageRatings(data.averageRatings ?? null)
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
          ? t("RateThisPerfume")
          : t("CommunityRatings")}
      </h2>

      {!isLoggedIn && (
        <p className="text-sm text-noir-gold-500 mb-4 text-center">
          {t("loginToRate")}
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
                onChange={(rating) => handleRatingChange(key, rating)}
                readonly={!isInteractive}
                showLabel
              />
              <div className="text-xs text-noir-gold-100 text-center">
                {averageRatings && averageRatings[key] != null ? (
                  <>
                    {t("communityAverage")}: {Number(averageRatings[key]).toFixed(1)}/5
                    {averageRatings.totalRatings > 0 && (
                      <span className="ml-1">
                        ({averageRatings.totalRatings}{" "}
                        {t("totalRatings", { count: averageRatings.totalRatings })})
                        {isRefreshing && " …"}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-noir-gold-100">{t("notYetRated")}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PerfumeRatingSystem
