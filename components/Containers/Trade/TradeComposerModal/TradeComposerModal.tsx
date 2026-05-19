"use client"

import { useTranslations } from "next-intl"

import TradeComposer from "@/components/Containers/Trade/TradeComposer/TradeComposer"
import type { TradeComposerModalData } from "@/hooks/useTradeComposerModal"
import type { TraderReputationV1 } from "@/services/reputation/types"
import { getTradeCtaLabelKey } from "@/types/trade"

type TradeComposerModalProps = {
  data: TradeComposerModalData
  onClose?: () => void
  onViewProfileClick?: () => void
  traderReputationByUserId?: Record<string, TraderReputationV1>
  stayOnPage?: boolean
  onListingPicked?: (init: import("@/types/trade").TradeComposerInit) => void
}

const TradeComposerModal = ({
  data,
  onClose,
  onViewProfileClick,
  traderReputationByUserId,
  stayOnPage = false,
  onListingPicked,
}: TradeComposerModalProps) => {
  const t = useTranslations("tradeComposer")

  if (data.mode === "pick") {
    return (
      <div className="w-full p-6">
        <h2>{t("pickTitle", { name: data.perfumeMeta.perfumeName })}</h2>
        <p className="mb-4 text-xl text-noir-gold-100">{t("pickSubheading")}</p>
        <TradeComposer
          init={{
            seed: {
              userPerfumeId: "",
              counterpartyId: "",
              perfumeName: data.perfumeMeta.perfumeName,
              available: "0",
            },
            counterpartyDisplayName: "",
          }}
          stayOnPage={stayOnPage}
          pickListings={data.listingsToPick}
          pickPerfumeMeta={data.perfumeMeta}
          traderReputationByUserId={data.traderReputationByUserId}
          matchExplanationByListingId={data.matchExplanationByListingId}
          onViewProfileClick={onViewProfileClick}
          onPickListing={(_seed, init) => {
            onListingPicked?.(init)
          }}
        />
      </div>
    )
  }

  const ctaKey = getTradeCtaLabelKey(
    data.init.seed.tradePreference,
    data.init.seed.tradeOnly
  )

  return (
    <div className="w-full p-6">
      <h2>{t(ctaKey)}</h2>
      <p className="mb-4 text-xl text-noir-gold-100">
        {t("subheading", { traderName: data.init.counterpartyDisplayName })}
      </p>
      <TradeComposer
        init={data.init}
        onSuccess={onClose}
        onViewProfileClick={onViewProfileClick}
        traderReputationByUserId={traderReputationByUserId}
        stayOnPage={stayOnPage}
      />
    </div>
  )
}

export default TradeComposerModal
