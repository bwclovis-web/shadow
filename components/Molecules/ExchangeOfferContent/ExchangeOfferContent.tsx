"use client"

import { useTranslations } from "next-intl"

import { Button, VooDooLink } from "@/components/Atoms/Button"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { ExchangeOfferFillDisplay } from "@/components/Molecules/ExchangeOfferFillDisplay/ExchangeOfferFillDisplay"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import { getTradeCtaLabelKey } from "@/types/trade"
import { resolveOfferFillPercent } from "@/utils/exchange-offer-fill"
import { getExchangeListingTradeDisplay } from "@/utils/exchangeListingTradeDisplay"
import { getTraderDisplayName } from "@/utils/user"

export type ExchangeOfferContentProps = {
  offer: ExchangeOfferDto
  perfumeImage?: string | null
  viewerId?: string | null
  signInHref: string
  onContact: (offer: ExchangeOfferDto) => void
  contactBusy?: boolean
  removed?: boolean
}

/**
 * Shared offer body for collectors panel, sheet, and list expansion.
 * Photo lightbox uses the app Modal (session store) — parent traps must pause while open.
 */
export const ExchangeOfferContent = ({
  offer,
  perfumeImage = null,
  viewerId = null,
  signInHref,
  onContact,
  contactBusy = false,
  removed = false,
}: ExchangeOfferContentProps) => {
  const t = useTranslations("tradingPost.listings")
  const tComposer = useTranslations("tradeComposer")
  const tProfile = useTranslations("traderProfile")
  const tListing = useTranslations("listing")

  const traderName = getTraderDisplayName(offer.user)
  const fillPercent = resolveOfferFillPercent(offer)
  const { preference, showPrice, showTradePrice } = getExchangeListingTradeDisplay({
    tradePreference: offer.tradePreference,
    tradeOnly: offer.tradeOnly,
    price: offer.price,
    tradePrice: offer.tradePrice,
  })

  const prefLabel =
    preference === "cash"
      ? tProfile("preferences.cash")
      : preference === "trade"
        ? tProfile("preferences.exchange")
        : tProfile("preferences.both")

  const typeLabel =
    getPerfumeTypeLabel(offer.type ?? undefined) || t("unknownType")
  const isOwn = Boolean(viewerId && offer.userId === viewerId)
  const canContact = Boolean(viewerId) && !isOwn && !removed

  return (
    <article className="rounded-md border border-noir-gold/30 bg-noir-black/40 p-3 text-sm text-noir-gold-100">
      {removed ? (
        <p className="text-noir-gold-500" role="status">
          {t("offerUnavailable")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <PrefetchLink
            href={`/trader-profile/${offer.userId}`}
            prefetch={false}
            className="text-base font-semibold text-noir-blue underline decoration-noir-gold/40 hover:text-noir-gold-100"
          >
            {traderName}
          </PrefetchLink>
          <p className="mt-1 text-noir-gold-100">
            <span className="text-noir-gold-500">{tProfile("amount")}:</span>{" "}
            <span className="font-medium">
              {offer.available} ml · {typeLabel}
            </span>
            {offer.condition ? (
              <>
                {" · "}
                <span>{tListing(`condition.${offer.condition}`)}</span>
              </>
            ) : null}
          </p>
          {fillPercent != null ? (
            <ExchangeOfferFillDisplay percent={fillPercent} className="mt-1" />
          ) : null}
        </div>

        <div className="text-right">
          <p>
            <span className="text-noir-gold-500">{tProfile("preference")}:</span>{" "}
            {prefLabel}
          </p>
          {showPrice && offer.price ? (
            <p className="mt-1 font-semibold text-noir-gold">
              ${offer.price}
              <span className="text-xs font-normal text-noir-gold-500">/ml</span>
            </p>
          ) : null}
          {showTradePrice && offer.tradePrice ? (
            <p className="mt-1 text-noir-gold-100">
              {tProfile("tradePrice")}: ${offer.tradePrice}/ml
            </p>
          ) : null}
        </div>
      </div>

      <ListingPhotos
        images={offer.images}
        perfumeImage={perfumeImage}
        condition={offer.condition}
        tradePreference={offer.tradePreference}
        tradeOnly={offer.tradeOnly}
        className="mt-3"
        lightboxSize="default"
        trigger="thumbnails"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {canContact ? (
          <Button
            type="button"
            variant="primary"
            background="gold"
            size="sm"
            disabled={contactBusy}
            className="w-full max-w-full sm:w-auto"
            onClick={() => onContact(offer)}
          >
            {tComposer(
              getTradeCtaLabelKey(offer.tradePreference, offer.tradeOnly)
            )}
          </Button>
        ) : null}
        {!viewerId && !removed ? (
          <VooDooLink
            url={signInHref}
            variant="primary"
            background="gold"
            className="w-full max-w-full sm:w-auto"
          >
            {t("signInToContact")}
          </VooDooLink>
        ) : null}
        {isOwn ? (
          <p className="text-xs text-noir-gold-500">{t("ownListingHint")}</p>
        ) : null}
      </div>
    </article>
  )
}
