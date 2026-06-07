"use client"

import { useTranslations } from "next-intl"

import VooDooDetails from "@/components/Atoms/VooDooDetails"
import InventoryStatsStrip from "@/components/Containers/MyScents/InventoryStatsStrip"
import type { UserInventoryStats } from "@/models/user-inventory-stats.server"

type MyScentsStatsHeaderProps = {
  stats: UserInventoryStats
}

const MyScentsStatsHeader = ({ stats }: MyScentsStatsHeaderProps) => {
  const t = useTranslations("myScents")

  return (
    <VooDooDetails
      name="inventory-at-a-glance"
      type="primary"
      background="dark"
      summary={t("inventory.atAGlance")}
      className="mb-4 w-full"
      defaultOpen
    >
      <div className="px-3 pb-4 pt-2">
        <InventoryStatsStrip stats={stats} />
      </div>
    </VooDooDetails>
  )
}

export default MyScentsStatsHeader
