"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { LuChevronDown } from "react-icons/lu"

import Select from "@/components/Atoms/Select/Select"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import VooDooCheck from "@/components/Atoms/VooDooCheck/VooDooCheck"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { Button } from "@/components/Atoms/Button/Button"
import { ExchangeCollectorsOffers } from "@/components/Molecules/ExchangeCollectorsOffers/ExchangeCollectorsOffers"
import DangerModal from "@/components/Organisms/DangerModal"
import Modal from "@/components/Organisms/Modal"
import type { ExchangeOffersStatus } from "@/hooks/useExchangeOffers"
import { useWishlistItemControls } from "@/hooks/useWishlistItemControls"
import {
  WISHLIST_BOTTLE_PREFERENCE_OPTIONS,
  type WishlistBottlePreference,
} from "@/lib/mutations/wishlist"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import type { SeekingWishlistItemDto } from "@/types/seeking"
import { CARD_THUMB_HOVER_CLASS } from "@/utils/card-motion"
import { normalizeRemoteImageSrc, styleMerge, validImageRegex } from "@/utils/styleUtils"

const FALLBACK_IMAGE = "/images/single-bottle.webp"

const goldLinkClass =
  "cursor-pointer text-sm font-medium text-noir-gold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"

const resolveImage = (image: string | null): string => {
  const src = normalizeRemoteImageSrc(image)
  if (src && !validImageRegex.test(src)) return src
  return FALLBACK_IMAGE
}

export type SeekingWishlistItemRowProps = {
  item: SeekingWishlistItemDto
  isAvailable: boolean
  expanded: boolean
  onToggleOffers: (trigger: HTMLButtonElement | null) => void
  offers: ExchangeOfferDto[]
  offersStatus: ExchangeOffersStatus
  offersError: string | null
  hasMoreOffers: boolean
  loadingMoreOffers: boolean
  viewerId: string | null
  signInHref: string
  removedOfferIds?: Set<string>
  contactBusyOfferId?: string | null
  onContactOffer: (offer: ExchangeOfferDto) => void
  onRetryOffers: () => void
  onLoadMoreOffers: () => void
  onRemove?: () => void
  onVisibilityChange?: () => void
}

const SeekingWishlistItemRow = ({
  item,
  isAvailable,
  expanded,
  onToggleOffers,
  offers,
  offersStatus,
  offersError,
  hasMoreOffers,
  loadingMoreOffers,
  viewerId,
  signInHref,
  removedOfferIds,
  contactBusyOfferId,
  onContactOffer,
  onRetryOffers,
  onLoadMoreOffers,
  onRemove,
  onVisibilityChange,
}: SeekingWishlistItemRowProps) => {
  const t = useTranslations("wishlist.itemCard")
  const tBottle = useTranslations("wishlist.bottlePreference")
  const tCommon = useTranslations("common")
  const controls = useWishlistItemControls(item, {
    onRemove,
    onVisibilityChange,
    actionErrorFallback: t("actionError"),
  })

  const houseName = item.perfume.perfumeHouse?.name
  const addedLabel = new Date(item.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  const panelId = `seeking-list-offers-${item.id}`
  const bottleOptions = WISHLIST_BOTTLE_PREFERENCE_OPTIONS.map(value => ({
    id: value,
    name: value,
    label: tBottle(value),
  }))

  return (
    <>
      {controls.removeModalOpen ? (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading={t("removeConfirmHeading")}
            description={t("removeConfirmDescription", {
              name: item.perfume.name,
            })}
            action={controls.handleConfirmRemove}
          />
        </Modal>
      ) : null}

      <OrnamentalFrame
        size="compact"
        as="article"
        className="group w-full bg-noir-black/40"
        data-seeking-card
        aria-busy={controls.pending}
      >
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4 md:p-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-noir-black sm:h-24 sm:w-24">
            <Image
              src={resolveImage(item.perfume.image)}
              alt={item.perfume.name}
              fill
              className={CARD_THUMB_HOVER_CLASS}
              sizes="96px"
              loading="lazy"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 !text-lg font-serif leading-tight text-noir-gold md:!text-xl">
                  {item.perfume.name}
                </h3>
                <span
                  className={styleMerge(
                    "shrink-0 rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                    isAvailable
                      ? "border-noir-gold/70 text-noir-gold"
                      : "border-noir-gold/30 text-noir-gold-100"
                  )}
                >
                  {isAvailable ? t("available") : t("stillSeeking")}
                </span>
              </div>
              <p className="mt-1 text-sm text-noir-gold-100">
                {houseName
                  ? t("byHouse", { house: houseName })
                  : t("unknownHouse")}
              </p>
              <p className="mt-1 text-xs text-noir-gold-100/80">
                {t("addedOn")} {addedLabel}
              </p>
              {isAvailable ? (
                <p className="mt-1 text-sm text-noir-gold">
                  {t("offerCount", { count: item.offerCount })}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                selectId={`wishlist-bottle-row-${item.id}`}
                label={t("bottlePreference")}
                selectData={bottleOptions}
                value={controls.bottlePreference}
                action={e =>
                  controls.handleBottlePreferenceChange(
                    e.target.value as WishlistBottlePreference
                  )
                }
                disabled={controls.pending}
                size="compact"
                className="w-full max-w-none md:w-full"
              />
              <div className="flex flex-col justify-end gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-noir-gold-100">
                    {t("visibility")}
                  </span>
                  <VooDooCheck
                    id={`wishlist-visibility-row-${item.id}`}
                    checked={controls.isPublic}
                    onChange={controls.handleVisibilityToggle}
                    labelChecked={t("public")}
                    labelUnchecked={t("private")}
                    disabled={controls.pending}
                  />
                </div>
                <p className="text-xs text-noir-gold-100/80">{t("privacyHint")}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <PrefetchLink
                href={`/perfume/${item.perfume.slug}`}
                prefetch={false}
                className={goldLinkClass}
              >
                {t("viewDetails")}
              </PrefetchLink>
              <span className="text-noir-gold/40" aria-hidden>
                |
              </span>
              <button
                type="button"
                disabled={controls.pending}
                className={styleMerge(
                  goldLinkClass,
                  "bg-transparent p-0 disabled:opacity-50"
                )}
                onClick={controls.openRemoveModal}
              >
                {t("remove")}
              </button>
              {isAvailable ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="ml-auto w-full sm:w-auto"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={e => onToggleOffers(e.currentTarget)}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {t("viewOffers")}
                    <LuChevronDown
                      className={styleMerge(
                        "h-4 w-4 transition-transform",
                        expanded && "rotate-180"
                      )}
                      aria-hidden
                    />
                  </span>
                </Button>
              ) : null}
            </div>

            {controls.actionError ? (
              <p className="text-xs text-red-300" role="alert">
                {controls.actionError}
              </p>
            ) : null}
            {controls.pending ? (
              <p className="sr-only" aria-live="polite">
                {tCommon("loading")}
              </p>
            ) : null}
          </div>
        </div>

        {isAvailable && expanded ? (
          <div
            id={panelId}
            className="border-t border-noir-gold/30 px-3 py-4 md:px-4"
          >
            <ExchangeCollectorsOffers
              perfumeName={item.perfume.name}
              perfumeImage={item.perfume.image}
              offers={offers}
              status={offersStatus}
              errorMessage={offersError}
              hasMore={hasMoreOffers}
              loadingMore={loadingMoreOffers}
              viewerId={viewerId}
              signInHref={signInHref}
              removedOfferIds={removedOfferIds}
              contactBusyOfferId={contactBusyOfferId}
              onContact={onContactOffer}
              onRetry={onRetryOffers}
              onLoadMore={onLoadMoreOffers}
            />
          </div>
        ) : null}
      </OrnamentalFrame>
    </>
  )
}

export default SeekingWishlistItemRow
