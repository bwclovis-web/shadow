"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"

import NoirRating from "@/components/Organisms/NoirRating"
import { useRatingSystem } from "@/hooks/useRatingSystem"
import { getRatings } from "@/lib/queries/reviews"
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
  const [refreshedAverageRatings, setRefreshedAverageRatings] =
    useState<PerfumeDetailAverageRatingsProp>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const averageRatings = refreshedAverageRatings ?? initialAverageRatings

  const refreshAverageRatings = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const data = await getRatings(perfumeId)
      setRefreshedAverageRatings(data.averageRatings ?? null)
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
    <div>
      <h3 className="min-w-min border-b border-noir-gold/20 pb-2 mb-4">
        {isInteractive
          ? t("RateThisPerfume")
          : t("CommunityRatings")}
      </h3>

      {!isLoggedIn && (
        <p className="text-sm text-noir-gold-500 mb-4">
          {t("loginToRate")}
        </p>
      )}

      <div className="space-y-6">
        {categories.map(({ key, label }) => (
          <div
            key={key}
            className={`flex flex-col rounded-lg border px-3 py-4 transition-[border-color,background-color,box-shadow,transform] duration-300 ease-out ${
              currentRatings?.[key]
                ? "border-noir-gold/45 bg-noir-gold/6 shadow-[0_10px_24px_rgba(212,175,55,0.08)]"
                : "border-noir-gold/15 bg-noir-black/15"
            }`}
          >
            <h3 className="mb-2">{label}</h3>
            <div className="flex flex-col items-center gap-2">
              <NoirRating
                category={key}
                value={currentRatings?.[key]}
                onChange={(rating) => handleRatingChange(key, rating)}
                readonly={!isInteractive}
                showLabel
              />
              <div
                className={`text-xs transition-colors duration-300 ${
                  isRefreshing ? "text-noir-gold" : "text-noir-gold-100"
                }`}
              >
                {averageRatings && averageRatings[key] != null ? (
                  <>
                    {t("communityAverage")}: {Number(averageRatings[key]).toFixed(1)}/5
                    {averageRatings.totalRatings > 0 && (
                      <span className="ml-1">
                        (
                        {t("totalRatings", {
                          count: averageRatings.totalRatings,
                        })}
                        )
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
