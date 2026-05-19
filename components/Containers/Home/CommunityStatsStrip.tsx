"use client"

import { useTranslations } from "next-intl"

import type { CommunityStats } from "@/models/community-stats.server"
import { styleMerge } from "@/utils/styleUtils"

type CommunityStatsStripProps = {
  stats: CommunityStats
  className?: string
}

const CommunityStatsStrip = ({ stats, className }: CommunityStatsStripProps) => {
  const t = useTranslations("home.communityStats")

  const items = [
    t("bottlesListed", { count: stats.bottlesListed }),
    t("tradesThisMonth", { count: stats.tradesCompletedThisMonth }),
    t("members", { count: stats.members }),
  ]

  return (
    <p
      className={styleMerge(
        "flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-noir-gold/90 md:text-base",
        className
      )}
      aria-label={t("ariaLabel", {
        bottlesListed: stats.bottlesListed,
        tradesThisMonth: stats.tradesCompletedThisMonth,
        members: stats.members,
      })}
    >
      {items.map((label, index) => (
        <span key={index} className="inline-flex items-center gap-x-2">
          {index > 0 ? (
            <span aria-hidden className="text-noir-gold/60">
              {t("separator")}
            </span>
          ) : null}
          <span>{label}</span>
        </span>
      ))}
    </p>
  )
}

export default CommunityStatsStrip
