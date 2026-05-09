"use client"

import { useTranslations } from "next-intl"
import { FaStar } from "react-icons/fa"

import type { ReputationBadgeId, TraderReputationV1 } from "@/services/reputation/types"
import { MIN_REVIEWS_FOR_SCORE } from "@/services/reputation/v1-constants"
import { TRADER_FEEDBACK_RATING_OPTIONS } from "@/utils/constants"

const RATING_OPTIONS_REVERSED = [...TRADER_FEEDBACK_RATING_OPTIONS].reverse()

const StarDisplay = ({ value }: { value: number }) => {
  const normalizedValue = Math.max(0, Math.min(5, value || 0))
  return (
    <>
      {RATING_OPTIONS_REVERSED.map((option) => {
        const isFilled = normalizedValue >= option - 0.25
        const isHalf = !isFilled && normalizedValue >= option - 0.75
        return (
          <FaStar
            key={option}
            className={`h-5 w-5 ${
              isFilled
                ? "text-noir-gold"
                : isHalf
                  ? "text-noir-gold-300"
                  : "text-noir-gold-800"
            }`}
          />
        )
      })}
    </>
  )
}

const BADGE_ORDER: ReputationBadgeId[] = [
  "reliableTrader",
  "topReviewed",
  "fastResponder",
]

function sortBadges(ids: ReputationBadgeId[]): ReputationBadgeId[] {
  const set = new Set(ids)
  return BADGE_ORDER.filter((id) => set.has(id))
}

type TraderTrustSummaryProps = {
  reputation: TraderReputationV1
}

export const TraderTrustSummary = ({ reputation }: TraderTrustSummaryProps) => {
  const t = useTranslations("traderProfile.reputation")

  const hasAvg =
    reputation.averageRating !== null && reputation.totalReviews > 0
  const avgDisplay = hasAvg ? Number(reputation.averageRating).toFixed(1) : null

  const insufficientCopy =
    reputation.insufficientDataReason === "noReviews"
      ? t("insufficientNoReviews")
      : reputation.insufficientDataReason === "tooFewReviews"
        ? t("insufficientTooFew", { min: MIN_REVIEWS_FOR_SCORE })
        : null

  const badges = sortBadges(reputation.badges)

  return (
    <section
      className="noir-border relative w-full p-4 mb-4 bg-noir-black/50"
      aria-label={t("ariaLabel")}
    >
      <div className="flex flex-col gap-1  md:items-start md:justify-between">
        <h2 className="text-lg font-semibold text-noir-gold">{t("title")}</h2>
        <p className="text-sm text-noir-gold-100 mt-1">{t("subtitle")}</p>
        <div>

        {reputation.score !== null ? (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-noir-gold-500">
                {t("scoreLabel")}
              </div>
              <div className="text-3xl font-bold tabular-nums text-noir-gold">
                {t("scoreOutOf", { score: reputation.score })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-noir-gold-100 max-w-sm text-left md:text-right">
              {insufficientCopy}
            </p>
          )}

          {hasAvg && avgDisplay !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <StarDisplay value={reputation.averageRating ?? 0} />
              <span className="text-noir-gold font-medium">{avgDisplay}</span>
              <span className="text-sm text-noir-gold-500">
                {t("reviewCountOnly", {
                  count: reputation.totalReviews,
                })}
              </span>
            </div>
          ) : reputation.totalReviews === 0 ? (
            <span className="text-sm text-noir-gold-500">{t("noReviewsDetail")}</span>
          ) : null}
        </div>
      </div>

      {badges.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={t("badgesAria")}>
          {badges.map((id) => (
            <li key={id}>
              <span className="inline-flex items-center rounded-full border border-noir-gold/50 bg-noir-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-noir-gold">
                {t(`badges.${id}`)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <details className="mt-4 rounded-md border border-noir-gold/30 bg-noir-black/40 p-3 text-sm text-noir-gold-100">
        <summary className="cursor-pointer font-medium text-noir-gold select-none">
          {t("explainTitle")}
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>{t("explainIntro")}</li>
          <li>{t("explainScore", { minReviews: MIN_REVIEWS_FOR_SCORE })}</li>
          <li>{t("explainBadges")}</li>
          <li>{t("explainMessaging")}</li>
        </ul>
      </details>
    </section>
  )
}

export default TraderTrustSummary
