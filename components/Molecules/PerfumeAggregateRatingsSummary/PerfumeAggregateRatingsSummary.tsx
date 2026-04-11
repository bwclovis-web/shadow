"use client"

import { useTranslations } from "next-intl"

import type { CompareAverageRatingsDto } from "@/models/compare.server"
import { styleMerge } from "@/utils/styleUtils"

import type { RatingData } from "@/hooks/useRatingSystem"

export type PerfumeAggregateRatingsSummaryProps = {
  averageRatings: CompareAverageRatingsDto | null
  className?: string
}

/**
 * Read-only community rating averages (same labels as `PerfumeRatingSystem`).
 */
export function PerfumeAggregateRatingsSummary({
  averageRatings,
  className,
}: PerfumeAggregateRatingsSummaryProps) {
  const tCat = useTranslations("singlePerfume.rating.categories")
  const t = useTranslations("singlePerfume.rating")

  const categories: { key: keyof RatingData; label: string }[] = [
    { key: "longevity", label: tCat("longevity") },
    { key: "sillage", label: tCat("sillage") },
    { key: "gender", label: tCat("gender") },
    { key: "priceValue", label: tCat("priceValue") },
    { key: "overall", label: tCat("overall") },
  ]

  return (
    <div
      className={styleMerge(
        "bg-noir-dark/20 rounded-lg p-4 text-noir-gold-100",
        className
      )}
    >
      <h3 className="text-lg font-bold text-noir-gold mb-3 text-center">
        {t("CommunityRatings")}
      </h3>
      {!averageRatings || averageRatings.totalRatings === 0 ? (
        <p className="text-sm text-center text-noir-gold-500">{t("notYetRated")}</p>
      ) : (
        <>
          <ul className="space-y-2 text-sm">
            {categories.map(({ key, label }) => {
              const val = averageRatings[key]
              return (
                <li
                  key={key}
                  className="flex justify-between gap-2 border-b border-noir-light/10 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-noir-gold shrink-0">{label}</span>
                  <span className="text-right tabular-nums">
                    {val != null ? `${Number(val).toFixed(1)}/5` : "—"}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-noir-gold-500 text-center mt-3">
            {t("communityAverage")} ·{" "}
            {t("totalRatings", { count: averageRatings.totalRatings })}
          </p>
        </>
      )}
    </div>
  )
}
