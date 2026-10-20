"use client"

import { memo } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import Select from "@/components/Atoms/Select/Select"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import VooDooCheck from "@/components/Atoms/VooDooCheck/VooDooCheck"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import DangerModal from "@/components/Organisms/DangerModal"
import Modal from "@/components/Organisms/Modal"
import { useWishlistItemControls } from "@/hooks/useWishlistItemControls"
import {
  WISHLIST_BOTTLE_PREFERENCE_OPTIONS,
  type WishlistBottlePreference,
} from "@/lib/mutations/wishlist"
import { CARD_IMAGE_HOVER_CLASS } from "@/utils/card-motion"
import { normalizeRemoteImageSrc, styleMerge, validImageRegex } from "@/utils/styleUtils"

import {
  wishlistBadgeVariants,
  wishlistBodyVariants,
  wishlistVariants,
} from "./wishlist-variants"

const FALLBACK_IMAGE = "/images/single-bottle.webp"

const goldLinkClass =
  "cursor-pointer text-sm font-medium text-noir-gold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"

export type WishlistItemCardPerfume = {
  id: string
  name: string
  slug: string
  image: string | null
  perfumeHouse: { id: string; name: string; slug: string } | null
}

export type WishlistItemCardItem = {
  id: string
  perfumeId?: string
  isPublic: boolean
  bottlePreference?: WishlistBottlePreference | null
  createdAt: Date | string
  perfume: WishlistItemCardPerfume
}

export type WishlistItemCardProps = {
  item: WishlistItemCardItem
  isAvailable: boolean
  offerCount?: number
  /** @deprecated Unused — ml is never inferred from ambiguous quantities. */
  availableAmount?: number
  onRemove?: () => void
  onVisibilityChange?: () => void
  /** Opens on-demand offers (panel / sheet). Available cards only. */
  onViewOffers?: (trigger: HTMLButtonElement | null) => void
}

const resolveImage = (image: string | null): string => {
  const src = normalizeRemoteImageSrc(image)
  if (src && !validImageRegex.test(src)) return src
  return FALLBACK_IMAGE
}

const WishlistItemCard = memo(({
  item,
  isAvailable,
  offerCount = 0,
  onRemove,
  onVisibilityChange,
  onViewOffers,
}: WishlistItemCardProps) => {
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

      <OrnamentalFrame size="compact" className="h-full w-full max-w-md justify-self-start">
        <article
          className={styleMerge("group", wishlistVariants({ isAvailable }))}
          data-seeking-card
          aria-busy={controls.pending}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-noir-black">
            <Image
              src={resolveImage(item.perfume.image)}
              alt={item.perfume.name}
              fill
              quality={75}
              sizes="(min-width: 1024px) 22vw, (min-width: 768px) 40vw, 92vw"
              className={CARD_IMAGE_HOVER_CLASS}
            />
            <span className={styleMerge(wishlistBadgeVariants({ isAvailable }))}>
              {isAvailable ? t("available") : t("stillSeeking")}
            </span>
          </div>

          <div className={wishlistBodyVariants()}>
            <div>
              <h3 className="!text-lg font-serif leading-tight text-noir-gold md:!text-xl">
                {item.perfume.name}
              </h3>
              <p className="mt-1 text-sm text-noir-gold-100">
                {houseName
                  ? t("byHouse", { house: houseName })
                  : t("unknownHouse")}
              </p>
              <p className="mt-2 text-xs text-noir-gold-100/80">
                {t("addedOn")} {addedLabel}
              </p>
            </div>

            {isAvailable ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-noir-gold">
                  {t("offerCount", { count: offerCount })}
                </span>
                <button
                  type="button"
                  className={styleMerge(goldLinkClass, "bg-transparent p-0")}
                  onClick={e => onViewOffers?.(e.currentTarget)}
                >
                  {t("viewOffers")}
                </button>
              </div>
            ) : null}

            <div>
              <Select
                selectId={`wishlist-bottle-${item.id}`}
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
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-noir-gold-100">
                  {t("visibility")}
                </span>
                <VooDooCheck
                  id={`wishlist-visibility-${item.id}`}
                  checked={controls.isPublic}
                  onChange={controls.handleVisibilityToggle}
                  labelChecked={t("public")}
                  labelUnchecked={t("private")}
                  disabled={controls.pending}
                />
              </div>
              <p className="text-xs text-noir-gold-100/80">{t("privacyHint")}</p>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-noir-gold/25 pt-3">
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
        </article>
      </OrnamentalFrame>
    </>
  )
})
WishlistItemCard.displayName = "WishlistItemCard"

export default WishlistItemCard
