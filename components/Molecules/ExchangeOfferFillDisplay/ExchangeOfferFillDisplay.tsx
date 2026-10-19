"use client"

import { useTranslations } from "next-intl"

import { ExchangeBottleMark } from "@/components/Atoms/ExchangeBottleMark"
import { styleMerge } from "@/utils/styleUtils"

type ExchangeOfferFillDisplayProps = {
  /** Validated 0–100 only — caller must use resolveOfferFillPercent. */
  percent: number
  className?: string
}

/**
 * Separate from NoirRating: outline bottle mark + explicit accessible text.
 * Does not change rating semantics or animate rating liquid.
 */
export const ExchangeOfferFillDisplay = ({
  percent,
  className,
}: ExchangeOfferFillDisplayProps) => {
  const t = useTranslations("tradingPost.listings")
  const safe = Math.min(100, Math.max(0, Math.round(percent)))

  return (
    <span
      className={styleMerge(
        "inline-flex items-center gap-1.5 text-sm text-noir-gold-100",
        className
      )}
    >
      <ExchangeBottleMark className="h-3.5 w-3.5" />
      <span>{t("fillRemaining", { percent: safe })}</span>
    </span>
  )
}
