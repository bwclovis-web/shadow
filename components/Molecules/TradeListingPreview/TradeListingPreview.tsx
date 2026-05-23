"use client"

import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import type { TradeListingSeed } from "@/types/trade"
import { getExchangeListingTradeDisplay } from "@/utils/exchangeListingTradeDisplay"
import { styleMerge } from "@/utils/styleUtils"

type TradeListingPreviewProps = {
  seed: TradeListingSeed
  traderName?: string
  reputationScore?: number | null
  /** Closes parent modal before navigating to the trader profile. */
  onViewProfileClick?: () => void
  compact?: boolean
  className?: string
}

const TradeListingPreview = ({
  seed,
  traderName,
  reputationScore,
  onViewProfileClick,
  compact = false,
  className,
}: TradeListingPreviewProps) => {
  const t = useTranslations("traderProfile")
  const tRep = useTranslations("traderProfile.reputation")
  const tListings = useTranslations("tradingPost.listings")
  const tComposer = useTranslations("tradeComposer")

  const { preference, showPrice, showTradePrice } = getExchangeListingTradeDisplay({
    tradePreference: seed.tradePreference ?? null,
    tradeOnly: seed.tradeOnly ?? false,
    price: seed.price,
    tradePrice: seed.tradePrice,
  })

  const prefLabel = (() => {
    switch (preference) {
      case "cash":
        return t("preferences.cash")
      case "trade":
        return t("preferences.trade")
      case "both":
        return t("preferences.both")
      default:
        return t("preferences.cash")
    }
  })()

  const typeLabel =
    getPerfumeTypeLabel(seed.type ?? undefined) || tListings("unknownType")

  return (
    <div
      className={styleMerge(
        "noir-border bg-noir-dark/40 text-sm text-noir-gold-100",
        compact ? "p-2" : "p-3",
        className
      )}
    >
      {traderName ? (
        <p className={styleMerge("font-semibold text-noir-gold", compact ? "text-sm" : "text-base")}>
          {tComposer("contactAboutHeading", { traderName })}
          {reputationScore != null ? (
            <span className="ml-2 text-xs font-normal text-noir-gold-500">
              ({tRep("exchangeTrust", { score: reputationScore })})
            </span>
          ) : null}
        </p>
      ) : null}
      
      <p className={styleMerge("font-semibold text-noir-gold", compact ? "text-sm mt-1" : "text-lg mt-2")}>
        {seed.perfumeName}
      </p>
      {seed.perfumeHouse ? (
        <p className="text-noir-gold-500">{seed.perfumeHouse}</p>
      ) : null}
      {!compact ? (
        <ListingPhotos
          images={seed.images}
          perfumeImage={seed.perfumeImage}
          condition={seed.condition}
          tradePreference={seed.tradePreference}
          tradeOnly={seed.tradeOnly}
          className="mt-2"
          lightboxSize="default"
        />
      ) : null}
      <p className="mt-2">
        <span className="text-noir-gold-500">{t("amount")}: </span>
        <span className="font-medium text-noir-gold-100">
          {seed.available} ml · {typeLabel}
        </span>
      </p>
      <p className="mt-1">
        <span className="text-noir-gold-500">{t("preference")}: </span>
        <span>{prefLabel}</span>
      </p>
      {showTradePrice && seed.tradePrice ? (
        <p className="mt-1">
          <span className="text-noir-gold-500">{t("tradePrice")}: </span>
          <span>${seed.tradePrice}/ml</span>
        </p>
      ) : null}
      {showPrice && seed.price ? (
        <p className="mt-1">
          <span className="text-noir-gold-500">{t("price")}: </span>
          <span>${seed.price}/ml</span>
        </p>
      ) : null}
      {seed.counterpartyId && traderName && !compact ? (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-noir-gold-500">{traderName}: </span>
            <PrefetchLink
              href={`/trader-profile/${seed.counterpartyId}`}
              prefetch={false}
              className="text-sm text-noir-blue underline decoration-noir-gold/40 hover:text-noir-gold-100"
              onClick={() => onViewProfileClick?.()}
            >
              {tComposer("viewTraderProfile")}
            </PrefetchLink>
        </div>
      ) : null}
    </div>
  )
}

export default TradeListingPreview
