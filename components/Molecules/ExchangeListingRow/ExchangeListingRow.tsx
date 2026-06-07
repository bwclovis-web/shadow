"use client"

import { memo } from "react"
import { useTranslations } from "next-intl"
import { GiTrade } from "react-icons/gi"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import { Button } from "@/components/Atoms/Button/Button"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { TradeMatchReasonLine } from "@/components/Molecules/TradeMatchReasonLine"
import type { TraderReputationV1 } from "@/services/reputation/types"
import type { TradeMatchExplanation } from "@/services/trade-match"
import { getExchangeListingTradeDisplay } from "@/utils/exchangeListingTradeDisplay"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import { getTradeCtaLabelKey } from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"

type ExchangeListingRowProps = {
  listing: ExchangeUserPerfumeRow
  perfumeImage?: string | null
  reputation?: TraderReputationV1 | null
  matchExplanation?: TradeMatchExplanation | null
  onMakeOffer?: () => void
  onViewProfileClick?: () => void
  showMakeOffer?: boolean
  showProfileLink?: boolean
}

const ExchangeListingRow = memo(({
  listing,
  perfumeImage = null,
  reputation,
  matchExplanation,
  onMakeOffer,
  onViewProfileClick,
  showMakeOffer = false,
  showProfileLink = true,
}: ExchangeListingRowProps) => {
  const t = useTranslations("tradingPost.listings")
  const tComposer = useTranslations("tradeComposer")
  const tProfile = useTranslations("traderProfile")
  const tRep = useTranslations("traderProfile.reputation")

  const { preference, showPrice, showTradePrice } = getExchangeListingTradeDisplay({
    tradePreference: listing.tradePreference,
    tradeOnly: listing.tradeOnly,
    price: listing.price,
    tradePrice: listing.tradePrice,
  })

  const prefLabel = (() => {
    switch (preference) {
      case "cash":
        return tProfile("preferences.cash")
      case "trade":
        return tProfile("preferences.exchange")
      case "both":
        return tProfile("preferences.both")
      default:
        return tProfile("preferences.cash")
    }
  })()

  const typeLabel =
    getPerfumeTypeLabel(listing.type ?? undefined) || t("unknownType")

  const traderName = getTraderDisplayName(listing.user)

  return (
    <li className="noir-border bg-noir-dark/40 p-3 text-sm text-noir-gold-100">
      {showProfileLink ? (
        <PrefetchLink
          href={`/trader-profile/${listing.userId}`}
          prefetch={false}
          className="text-base font-semibold text-noir-blue underline decoration-noir-gold/40 hover:text-noir-gold-100"
          onClick={() => onViewProfileClick?.()}
        >
          {traderName}
        </PrefetchLink>
      ) : (
        <p className="text-base font-semibold text-noir-gold">{traderName}</p>
      )}
      {reputation?.score != null ? (
        <span className="ml-2 text-noir-gold-500">
          ({tRep("exchangeTrust", { score: reputation.score })})
        </span>
      ) : null}
      {matchExplanation ? (
        <div className="mt-2">
          <TradeMatchReasonLine reasons={matchExplanation.reasons} />
        </div>
      ) : null}
      <ListingPhotos
        images={listing.images}
        perfumeImage={perfumeImage}
        condition={listing.condition}
        tradePreference={listing.tradePreference}
        tradeOnly={listing.tradeOnly}
        className="mt-2"
        lightboxSize="default"
        trigger="button"
      />
      <p className="mt-2 text-noir-gold-100">
        <span className="text-noir-gold-500">{tProfile("amount")}:</span>{" "}
        <span className="font-medium text-noir-gold-100">
          {listing.available} ml · {typeLabel}
        </span>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mt-1">
          <span className="text-noir-gold-500">{tProfile("preference")}:</span>{" "}
          <span className="text-noir-gold-100">{prefLabel}</span>
        </p>
        {showTradePrice && listing.tradePrice ? (
          <p className="mt-1">
            <span className="text-noir-gold-500">{tProfile("tradePrice")}:</span>{" "}
            <span className="text-noir-gold-100">${listing.tradePrice}/ml</span>
          </p>
        ) : null}
        {showPrice && listing.price ? (
          <p className="mt-1">
            <span className="text-noir-gold-500">{tProfile("price")}:</span>{" "}
            <span className="text-noir-gold-100">${listing.price}/ml</span>
          </p>
        ) : null}
      </div>
      {listing.tradeOnly ? (
        <div className="mt-2 flex items-center gap-2 font-medium text-noir-gold-500">
          <GiTrade size={18} className="shrink-0 fill-noir-gold-100" />
          <span>{tProfile("tradeOnly")}</span>
        </div>
      ) : null}
      {showMakeOffer && onMakeOffer ? (
        <Button
          type="button"
          variant="primary"
          background="gold"
          size="sm"
          className="mt-3 w-full max-w-full sm:w-auto"
          onClick={onMakeOffer}
        >
          {tComposer(getTradeCtaLabelKey(listing.tradePreference, listing.tradeOnly))}
        </Button>
      ) : null}
    </li>
  )
})
ExchangeListingRow.displayName = "ExchangeListingRow"

export default ExchangeListingRow
