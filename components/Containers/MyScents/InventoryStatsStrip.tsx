"use client"

import { useTranslations } from "next-intl"

import type { UserInventoryStats } from "@/models/user-inventory-stats.server"
import { styleMerge } from "@/utils/styleUtils"

type InventoryStatsStripProps = {
  stats: UserInventoryStats
  className?: string
}

const StatCard = ({
  label,
  value,
  hint,
  isText = false,
}: {
  label: string
  value: string
  hint: string
  isText?: boolean
}) => (
  <div className="noir-border rounded-lg bg-noir-black/40 p-4 text-left">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-noir-gold">{label}</h3>
    <p
      className={
        isText
          ? "mt-2 text-sm text-noir-gold-100"
          : "mt-2 text-3xl font-bold text-noir-cream"
      }
    >
      {value}
    </p>
    <p className="mt-1 text-xs text-noir-gold-500">{hint}</p>
  </div>
)

const InventoryStatsStrip = ({ stats, className }: InventoryStatsStripProps) => {
  const t = useTranslations("myScents.stats")
  const tFamilies = useTranslations("traderProfile.scentDna.families")

  const familyLabels =
    stats.topFamilies.length > 0
      ? stats.topFamilies
          .map((f) => tFamilies(f.family))
          .join(", ")
      : t("familiesEmpty")

  return (
    <div
      className={styleMerge(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      <StatCard label={t("bottles")} value={String(stats.bottleCount)} hint={t("bottlesHint")} />
      <StatCard label={t("houses")} value={String(stats.houseCount)} hint={t("housesHint")} />
      <StatCard label={t("families")} value={familyLabels} hint={t("familiesHint")} isText />
      <StatCard
        label={t("tradedValue")}
        value={
          stats.tradedValue > 0
            ? t("tradedValueAmount", { amount: stats.tradedValue.toFixed(0) })
            : t("tradedValueEmpty")
        }
        hint={t("tradedValueFootnote")}
        isText={stats.tradedValue <= 0}
      />
    </div>
  )
}

export default InventoryStatsStrip
