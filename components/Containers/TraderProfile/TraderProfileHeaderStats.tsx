"use client"

import { useTranslations } from "next-intl"

import { RecentlyActiveBadge } from "@/components/Atoms/RecentlyActiveBadge"

type TraderProfileHeaderStatsProps = {
  memberSince: string
  completedTradeCount: number
  followerCount?: number
  lastActiveAt?: Date | string | null
}

const TraderProfileHeaderStats = ({
  memberSince,
  completedTradeCount,
  followerCount = 0,
  lastActiveAt = null,
}: TraderProfileHeaderStatsProps) => {
  const t = useTranslations("traderProfile.headerStats")
  const memberDate = new Date(memberSince)
  const memberSinceLabel = Number.isNaN(memberDate.getTime())
    ? null
    : memberDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
      })

  return (
    <ul
      className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-noir-gold-100"
      aria-label={t("ariaLabel")}
    >
      {memberSinceLabel ? (
        <li>
          <span className="text-noir-gold-500">{t("memberSince")}: </span>
          <span className="font-medium text-noir-gold">{memberSinceLabel}</span>
        </li>
      ) : null}
      <li>
        <span className="text-noir-gold-500">{t("completedTrades")}: </span>
        <span className="font-medium text-noir-gold tabular-nums">
          {completedTradeCount}
        </span>
      </li>
      {followerCount > 0 ? (
        <li>
          <span className="text-noir-gold-500">{t("followers")}: </span>
          <span className="font-medium text-noir-gold tabular-nums">{followerCount}</span>
        </li>
      ) : null}
      <li className="w-full flex justify-center sm:w-auto">
        <RecentlyActiveBadge lastActiveAt={lastActiveAt} />
      </li>
    </ul>
  )
}

export default TraderProfileHeaderStats
