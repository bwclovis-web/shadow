"use client"

import { useTranslations } from "next-intl"

import { ExchangeListingPicker } from "@/components/Molecules/ExchangeListingPicker"
import { tradeListingSeedFromExchangeRow } from "@/types/trade"
import type { TradeComposerInit } from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"

import type { ExchangePerfumeRow } from "./exchange-types"

type ExchangeTradersModalContentProps = {
  perfume: ExchangePerfumeRow
  traderReputationByUserId: Record<string, import("@/services/reputation/types").TraderReputationV1>
  viewerId?: string | null
  onMakeOffer?: (init: TradeComposerInit) => void
}

const ExchangeTradersModalContent = ({
  perfume,
  traderReputationByUserId,
  viewerId,
  onMakeOffer,
}: ExchangeTradersModalContentProps) => {
  const t = useTranslations("tradingPost.listings")
  const tComposer = useTranslations("tradeComposer")

  const perfumeMeta = {
    perfumeId: perfume.id,
    perfumeName: perfume.name,
    perfumeHouse: perfume.perfumeHouse?.name,
    perfumeImage: perfume.image ?? null,
  }

  const listings = perfume.userPerfume.filter(
    up => !viewerId || up.userId !== viewerId
  )

  const handleMakeOfferRow = (up: (typeof listings)[number]) => {
    if (!onMakeOffer || !viewerId || viewerId === up.userId) return
    const seed = tradeListingSeedFromExchangeRow(up, perfumeMeta)
    onMakeOffer({
      seed,
      counterpartyDisplayName: getTraderDisplayName(up.user),
    })
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 pt-2">
      <div className="border-b border-noir-gold/30 pb-3">
        <h2 id="exchange-traders-modal-title">
          {tComposer("proposeSwap")} — {perfume.name}
        </h2>
        {perfume.perfumeHouse?.name ? (
          <p className="text-sm text-noir-gold-100">
            {perfume.perfumeHouse.name}
          </p>
        ) : null}
      </div>

      <ExchangeListingPicker
        listings={listings}
        traderReputationByUserId={traderReputationByUserId}
        listResetKey={perfume.id}
        onSelectListing={handleMakeOfferRow}
        showMakeOffer={Boolean(viewerId && onMakeOffer)}
        listClassName="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pb-6"
      />
    </div>
  )
}

export default ExchangeTradersModalContent
