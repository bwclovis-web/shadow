"use client"

import { useTranslations } from "next-intl"

import { isRecentlyActive } from "@/utils/user-activity"
import { styleMerge } from "@/utils/styleUtils"

type RecentlyActiveBadgeProps = {
  lastActiveAt: Date | string | null | undefined
  className?: string
  /** `dot` shows only the indicator; `label` includes text. */
  variant?: "dot" | "label"
}

const RecentlyActiveBadge = ({
  lastActiveAt,
  className,
  variant = "label",
}: RecentlyActiveBadgeProps) => {
  const t = useTranslations("traderActivity")

  if (!isRecentlyActive(lastActiveAt)) return null

  if (variant === "dot") {
    return (
      <span
        className={styleMerge(
          "inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-noir-dark",
          className
        )}
        title={t("recentlyActive")}
        aria-label={t("recentlyActive")}
      />
    )
  }

  return (
    <span
      className={styleMerge(
        "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400/90",
        className
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
        aria-hidden
      />
      {t("recentlyActive")}
    </span>
  )
}

export default RecentlyActiveBadge
