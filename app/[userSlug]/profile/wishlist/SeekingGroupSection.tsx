"use client"

import { useRef } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import WishlistItemCard from "@/components/Organisms/WishlistItemCard/WishlistItemCard"
import type { ExchangeOffersStatus } from "@/hooks/useExchangeOffers"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import type { SeekingGroupPage, SeekingWishlistItemDto } from "@/types/seeking"
import { CARD_STAGGER_DEFAULT } from "@/utils/card-motion"
import type { SeekingView } from "@/utils/seeking-constants"
import { styleMerge } from "@/utils/styleUtils"

import SeekingWishlistItemRow from "./SeekingWishlistItemRow"

export type SeekingGroupSectionLabels = {
  heading: string
  showingRange: string
  empty: string
  previous: string
  next: string
  paginationNav: string
  pageStatus: string
}

export type SeekingOffersHostProps = {
  expandedPerfumeId: string | null
  offers: ExchangeOfferDto[]
  offersStatus: ExchangeOffersStatus
  offersError: string | null
  hasMoreOffers: boolean
  loadingMoreOffers: boolean
  viewerId: string | null
  signInHref: string
  removedOfferIds: Set<string>
  contactBusyOfferId: string | null
  onViewOffers: (
    item: SeekingWishlistItemDto,
    trigger: HTMLButtonElement | null
  ) => void
  onContactOffer: (offer: ExchangeOfferDto) => void
  onRetryOffers: () => void
  onLoadMoreOffers: () => void
}

type SeekingGroupSectionProps = {
  group: SeekingGroupPage
  view: SeekingView
  markAvailable: boolean
  labels: SeekingGroupSectionLabels
  onPageChange: (page: number) => void
  onRemoveItem: () => void
  onVisibilityChange?: () => void
  suppressItems?: boolean
  offersHost: SeekingOffersHostProps
}

const SeekingGroupSection = ({
  group,
  view,
  markAvailable,
  labels,
  onPageChange,
  onRemoveItem,
  onVisibilityChange,
  suppressItems = false,
  offersHost,
}: SeekingGroupSectionProps) => {
  const { meta, items } = group
  const showPagination = meta.totalPages > 1
  const showRange = meta.totalCount > 0 && meta.showingFrom > 0
  const itemsRef = useRef<HTMLDivElement>(null)
  const itemIds = items.map(item => item.id).join(",")

  useGsapStagger(itemsRef, {
    selector: "[data-seeking-card]",
    deps: [view, itemIds],
    enabled: !suppressItems && items.length > 0,
    ...CARD_STAGGER_DEFAULT,
  })

  return (
    <OrnamentalFrame size="standard" className="bg-noir-black/30" as="section">
      <div className="space-y-4 p-3 md:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h2 className="!text-xl font-serif text-noir-gold md:!text-2xl">
            {labels.heading}
          </h2>
          {showRange ? (
            <p className="text-sm text-noir-gold-100">{labels.showingRange}</p>
          ) : null}
        </div>

        {suppressItems ? null : meta.totalCount === 0 ? (
          <p className="py-6 text-center text-noir-gold-100">{labels.empty}</p>
        ) : (
          <div ref={itemsRef}>
            {view === "list" ? (
              <div className="flex flex-col gap-4">
                {items.map((item: SeekingWishlistItemDto) => {
                  const expanded =
                    markAvailable &&
                    offersHost.expandedPerfumeId === item.perfumeId
                  return (
                    <SeekingWishlistItemRow
                      key={item.id}
                      item={item}
                      isAvailable={markAvailable}
                      expanded={expanded}
                      onToggleOffers={trigger =>
                        offersHost.onViewOffers(item, trigger)
                      }
                      offers={expanded ? offersHost.offers : []}
                      offersStatus={expanded ? offersHost.offersStatus : "idle"}
                      offersError={expanded ? offersHost.offersError : null}
                      hasMoreOffers={
                        expanded ? offersHost.hasMoreOffers : false
                      }
                      loadingMoreOffers={
                        expanded ? offersHost.loadingMoreOffers : false
                      }
                      viewerId={offersHost.viewerId}
                      signInHref={offersHost.signInHref}
                      removedOfferIds={offersHost.removedOfferIds}
                      contactBusyOfferId={offersHost.contactBusyOfferId}
                      onContactOffer={offersHost.onContactOffer}
                      onRetryOffers={offersHost.onRetryOffers}
                      onLoadMoreOffers={offersHost.onLoadMoreOffers}
                      onRemove={onRemoveItem}
                      onVisibilityChange={onVisibilityChange}
                    />
                  )
                })}
              </div>
            ) : (
              <div
                className={styleMerge(
                  "grid grid-cols-1 justify-items-start gap-6 md:grid-cols-2 lg:grid-cols-3"
                )}
              >
                {items.map((item: SeekingWishlistItemDto) => (
                  <WishlistItemCard
                    key={item.id}
                    item={item}
                    isAvailable={markAvailable}
                    offerCount={markAvailable ? item.offerCount : 0}
                    onRemove={onRemoveItem}
                    onVisibilityChange={onVisibilityChange}
                    onViewOffers={
                      markAvailable
                        ? trigger => offersHost.onViewOffers(item, trigger)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {showPagination ? (
          <nav
            aria-label={labels.paginationNav}
            className="flex flex-col items-center gap-2 border-t border-noir-gold/20 pt-4"
          >
            <p className="text-sm text-noir-gold-100" aria-live="polite">
              {labels.pageStatus}
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!meta.hasPrevPage}
                aria-label={labels.previous}
                onClick={() => onPageChange(meta.currentPage - 1)}
              >
                {labels.previous}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!meta.hasNextPage}
                aria-label={labels.next}
                onClick={() => onPageChange(meta.currentPage + 1)}
              >
                {labels.next}
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </OrnamentalFrame>
  )
}

export default SeekingGroupSection
