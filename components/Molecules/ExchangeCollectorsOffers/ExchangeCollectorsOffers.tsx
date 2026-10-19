"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { ExchangeOfferContent } from "@/components/Molecules/ExchangeOfferContent/ExchangeOfferContent"
import type { ExchangeOffersStatus } from "@/hooks/useExchangeOffers"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"

export type ExchangeCollectorsOffersProps = {
  perfumeName: string
  perfumeImage?: string | null
  offers: ExchangeOfferDto[]
  status: ExchangeOffersStatus
  errorMessage: string | null
  hasMore: boolean
  loadingMore: boolean
  viewerId?: string | null
  signInHref: string
  removedOfferIds?: Set<string>
  contactBusyOfferId?: string | null
  onContact: (offer: ExchangeOfferDto) => void
  onRetry: () => void
  onLoadMore: () => void
}

export const ExchangeCollectorsOffers = ({
  perfumeName,
  perfumeImage,
  offers,
  status,
  errorMessage,
  hasMore,
  loadingMore,
  viewerId,
  signInHref,
  removedOfferIds,
  contactBusyOfferId,
  onContact,
  onRetry,
  onLoadMore,
}: ExchangeCollectorsOffersProps) => {
  const t = useTranslations("tradingPost.listings")

  if (status === "loading") {
    return (
      <p className="py-6 text-center text-noir-gold-500" role="status">
        {t("offersLoading")}
      </p>
    )
  }

  if (status === "error") {
    return (
      <div className="space-y-3 py-4 text-center" role="alert">
        <p className="text-noir-gold-100">
          {errorMessage || t("offersLoadFailed")}
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          {t("offersRetry")}
        </Button>
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <p className="py-6 text-center text-noir-gold-500" role="status">
        {t("offersEmpty", { name: perfumeName })}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="flex flex-col gap-3">
        {offers.map(offer => (
          <li key={offer.id}>
            <ExchangeOfferContent
              offer={offer}
              perfumeImage={perfumeImage}
              viewerId={viewerId}
              signInHref={signInHref}
              onContact={onContact}
              contactBusy={contactBusyOfferId === offer.id}
              removed={removedOfferIds?.has(offer.id)}
            />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? t("offersLoadingMore") : t("offersLoadMore")}
        </Button>
      ) : offers.length > 0 ? (
        <p className="text-center text-xs text-noir-gold-500">
          {t("offersEnd")}
        </p>
      ) : null}
      {errorMessage && status === "success" ? (
        <p className="text-center text-xs text-noir-gold-500" role="status">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
