"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { LuChevronDown } from "react-icons/lu"

import type { ExchangePerfumeRow } from "@/app/the-exchange/exchange-types"
import { Button } from "@/components/Atoms/Button/Button"
import { ExchangeBottleMark } from "@/components/Atoms/ExchangeBottleMark"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { ExchangeCollectorsOffers } from "@/components/Molecules/ExchangeCollectorsOffers/ExchangeCollectorsOffers"
import { PerfumeCompareToggle } from "@/components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle"
import type { ExchangeOffersStatus } from "@/hooks/useExchangeOffers"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import { resolveExchangeGroupImages } from "@/utils/exchange-group-images"
import { styleMerge } from "@/utils/styleUtils"

const FALLBACK = "/images/single-bottle.webp"

export type ExchangeFragranceGroupRowProps = {
  perfume: ExchangePerfumeRow
  expanded: boolean
  onToggle: (trigger: HTMLButtonElement | null) => void
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
  openSplitSlot?: React.ReactNode
}

export const ExchangeFragranceGroupRow = ({
  perfume,
  expanded,
  onToggle,
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
  openSplitSlot,
}: ExchangeFragranceGroupRowProps) => {
  const t = useTranslations("tradingPost.listings")
  const resolved = resolveExchangeGroupImages(perfume)
  const thumb = resolved.main.src || FALLBACK
  const panelId = `exchange-list-offers-${perfume.id}`

  return (
    <OrnamentalFrame size="compact" as="article" className="bg-noir-dark/80">
      <div className="relative flex flex-col gap-3 p-3 md:flex-row md:items-center md:gap-4 md:p-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-noir-black md:h-24 md:w-24">
          <Image
            src={thumb}
            alt=""
            fill
            className="object-contain p-1"
            sizes="96px"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="!text-xl !leading-snug break-words">
            <PrefetchLink
              href={`/perfume/${perfume.slug}`}
              className="text-noir-gold hover:text-noir-gold-100"
            >
              {perfume.name}
            </PrefetchLink>
          </h3>
          {perfume.perfumeHouse?.name ? (
            <p className="truncate text-sm text-noir-light/90">
              {perfume.perfumeHouse.name}
            </p>
          ) : null}
          {openSplitSlot}
          <p className="flex items-center gap-1.5 text-sm font-medium text-noir-gold">
            <ExchangeBottleMark />
            <span>{t("offerCount", { count: perfume.offerCount })}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-stretch">
          <Button
            type="button"
            variant="primary"
            background="gold"
            size="sm"
            className="w-full max-w-full md:w-auto"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={e => onToggle(e.currentTarget)}
          >
            <span className="inline-flex items-center gap-2">
              {t("viewCollectors")}
              <LuChevronDown
                className={styleMerge(
                  "h-4 w-4 transition-transform",
                  expanded && "rotate-180"
                )}
                aria-hidden
              />
            </span>
          </Button>
        </div>

        <div className="absolute right-2 top-2 md:static md:self-start">
          <div className="relative h-10 w-10">
            <PerfumeCompareToggle
              item={{
                id: perfume.id,
                slug: perfume.slug,
                name: perfume.name,
                image: perfume.image ?? undefined,
              }}
            />
          </div>
        </div>
      </div>

      {expanded ? (
        <div
          id={panelId}
          className="border-t border-noir-gold/30 px-3 py-4 md:px-4"
        >
          <ExchangeCollectorsOffers
            perfumeName={perfume.name}
            perfumeImage={perfume.image}
            offers={offers}
            status={status}
            errorMessage={errorMessage}
            hasMore={hasMore}
            loadingMore={loadingMore}
            viewerId={viewerId}
            signInHref={signInHref}
            removedOfferIds={removedOfferIds}
            contactBusyOfferId={contactBusyOfferId}
            onContact={onContact}
            onRetry={onRetry}
            onLoadMore={onLoadMore}
          />
        </div>
      ) : null}
    </OrnamentalFrame>
  )
}
