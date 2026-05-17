"use client"

import { useTranslations } from "next-intl"

import VooDooDetails from "@/components/Atoms/VooDooDetails"
import { TradeStatusCard } from "@/components/Molecules/TradeStatusCard"
import type { TradeForClient } from "@/types/trade"

type TraderProfileTradesProps = {
  activeTrades: TradeForClient[]
  viewerId: string
}

const TraderProfileTrades = ({
  activeTrades,
  viewerId,
}: TraderProfileTradesProps) => {
  const t = useTranslations("traderProfile.trades")

  if (activeTrades.length === 0) return null

  return (
    <VooDooDetails
      name="activeTrades"
      summary={t("activeSummary", { count: activeTrades.length })}
      className="text-noir-gold"
      background="dark"
    >
      <div className="space-y-3 py-2">
        {activeTrades.map(trade => (
          <TradeStatusCard
            key={trade.id}
            trade={trade}
            currentUserId={viewerId}
          />
        ))}
      </div>
    </VooDooDetails>
  )
}

export default TraderProfileTrades
