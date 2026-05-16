"use client"

import { useTranslations } from "next-intl"

const STRIKE_PIPS = 3

const pipColor = (strikeCount: number, index: number): string => {
  if (strikeCount === 0) return "bg-noir-gold-100/30"
  if (strikeCount <= 2) return index < strikeCount ? "bg-amber-500" : "bg-noir-gold-100/20"
  return index < STRIKE_PIPS ? "bg-red-600" : "bg-noir-gold-100/20"
}

const StrikeIndicators = ({
  strikeCount,
  isBanned,
}: {
  strikeCount: number
  isBanned: boolean
}) => {
  const t = useTranslations("userAdmin.table")
  const displayCount = Math.min(strikeCount, STRIKE_PIPS)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1" aria-label={t("strikesLabel", { count: strikeCount })}>
        {Array.from({ length: STRIKE_PIPS }, (_, i) => (
          <span
            key={i}
            className={`inline-block h-2.5 w-2.5 rounded-full ${pipColor(displayCount, i)}`}
          />
        ))}
      </div>
      {isBanned && (
        <span className="inline-flex w-fit rounded bg-red-900/60 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-300">
          {t("bannedBadge")}
        </span>
      )}
    </div>
  )
}

export default StrikeIndicators
