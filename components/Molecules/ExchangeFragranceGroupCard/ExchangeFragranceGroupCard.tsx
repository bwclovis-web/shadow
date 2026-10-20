"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"

import type { ExchangePerfumeRow } from "@/app/the-exchange/exchange-types"
import { Button } from "@/components/Atoms/Button"
import { ExchangeBottleMark } from "@/components/Atoms/ExchangeBottleMark"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { ListingImageBadges } from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { PerfumeCompareToggle } from "@/components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle"
import { PhotoLightbox } from "@/components/Molecules/PhotoLightbox/PhotoLightbox"
import { usePhotoLightbox } from "@/hooks/usePhotoLightbox"
import {
  resolveExchangeGroupImages,
  type ExchangeGroupImageSlot,
} from "@/utils/exchange-group-images"
import { CARD_IMAGE_HOVER_CLASS } from "@/utils/card-motion"
import { styleMerge } from "@/utils/styleUtils"

const LIGHTBOX_ID = "exchange-group-card-lightbox"
const FALLBACK_BOTTLE = "/images/single-bottle.webp"

export type ExchangeFragranceGroupCardProps = {
  perfume: ExchangePerfumeRow
  imagePriority?: boolean
  onViewCollectors: (trigger: HTMLButtonElement | null) => void
  viewCollectorsLabel: string
  openSplitSlot?: React.ReactNode
  className?: string
}

const GroupPhoto = ({
  slot,
  alt,
  priority,
  sizes,
  className,
  onOpen,
  /** Mock mosaics use cover; simple/fallback keep contain. */
  fit = "cover",
}: {
  slot: ExchangeGroupImageSlot
  alt: string
  priority?: boolean
  sizes: string
  className?: string
  onOpen: () => void
  fit?: "cover" | "contain"
}) => (
  <button
    type="button"
    onClick={onOpen}
    className={styleMerge(
      "relative block h-full w-full overflow-hidden bg-noir-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold",
      className
    )}
  >
    <Image
      src={slot.src || FALLBACK_BOTTLE}
      alt={alt}
      fill
      priority={priority}
      loading={priority ? undefined : "lazy"}
      className={
        fit === "cover"
          ? CARD_IMAGE_HOVER_CLASS
          : "object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      }
      sizes={sizes}
    />
  </button>
)

export const ExchangeFragranceGroupCard = ({
  perfume,
  imagePriority = false,
  onViewCollectors,
  viewCollectorsLabel,
  openSplitSlot,
  className,
}: ExchangeFragranceGroupCardProps) => {
  const t = useTranslations("tradingPost.listings")
  const resolved = resolveExchangeGroupImages(perfume)
  const perfumeHref = `/perfume/${perfume.slug}`
  const houseName = perfume.perfumeHouse?.name

  const { lightboxIndex, openLightbox, closeLightbox, goPrev, goNext } =
    usePhotoLightbox({
      imageCount: resolved.lightboxUrls.length,
      modalId: `${LIGHTBOX_ID}-${perfume.id}`,
    })

  const primaryBadges =
    resolved.main.kind === "seller"
      ? {
          condition: resolved.main.condition,
          tradePreference: resolved.main.tradePreference,
          tradeOnly: resolved.main.tradeOnly,
        }
      : null

  const showCollectorsCta = perfume.offerCount > 0
  const compareItem = {
    id: perfume.id,
    slug: perfume.slug,
    name: perfume.name,
    image: perfume.image ?? undefined,
  }

  return (
    <OrnamentalFrame
      size="compact"
      as="article"
      className={styleMerge("group h-full min-w-0 bg-noir-dark/80", className)}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="relative isolate overflow-hidden">
          {resolved.layout === "simple" ? (
            <div className="relative aspect-[3/2] w-full">
              <GroupPhoto
                slot={resolved.main}
                alt=""
                priority={imagePriority}
                fit={
                  resolved.main.kind === "seller" ||
                  resolved.main.kind === "catalog"
                    ? "cover"
                    : "contain"
                }
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                onOpen={() => openLightbox(0)}
              />
            </div>
          ) : (
            /* Mock: ~2:1 main/side, square side thumbs, visible gutters */
            <div className="grid aspect-[3/2] grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-1.5 bg-noir-black p-1.5">
              <GroupPhoto
                slot={resolved.main}
                alt=""
                priority={imagePriority}
                fit="cover"
                sizes="(min-width: 1024px) 22vw, (min-width: 768px) 35vw, 70vw"
                onOpen={() => openLightbox(0)}
              />
              <div className="grid min-h-0 grid-rows-2 gap-1.5">
                {resolved.sides.map((slot, index) => (
                  <GroupPhoto
                    key={`${slot.userPerfumeId ?? slot.src}-${index}`}
                    slot={slot}
                    alt=""
                    fit="cover"
                    sizes="(min-width: 1024px) 11vw, 28vw"
                    onOpen={() => openLightbox(index + 1)}
                  />
                ))}
                {resolved.sides.length === 1 ? (
                  <div className="bg-noir-dark/90" aria-hidden />
                ) : null}
              </div>
            </div>
          )}

          {primaryBadges ? (
            <div className="pointer-events-none absolute left-2.5 top-2.5 z-10">
              <ListingImageBadges
                condition={primaryBadges.condition}
                tradePreference={primaryBadges.tradePreference}
                tradeOnly={primaryBadges.tradeOnly}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
          <h3 className="!text-xl !leading-snug break-words md:!text-2xl">
            <PrefetchLink
              href={perfumeHref}
              className="text-noir-gold hover:text-noir-gold-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"
            >
              {perfume.name}
            </PrefetchLink>
          </h3>

          {houseName ? (
            <p className="truncate text-sm text-noir-light/90">{houseName}</p>
          ) : null}

          {openSplitSlot}

          <p className="flex items-center justify-start gap-1 text-sm font-medium text-noir-gold">
            <ExchangeBottleMark className="h-7 w-[16px] shrink-0" />
            <span>
              {t("offerCount", {
                count: perfume.offerCount,
              })}
            </span>
          </p>

          <div className="mt-auto flex flex-col gap-2 pt-1">
            {showCollectorsCta ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                background="gold"
                className="w-full max-w-full"
                onClick={e => onViewCollectors(e.currentTarget)}
              >
                {viewCollectorsLabel}
              </Button>
            ) : null}
            <PerfumeCompareToggle item={compareItem} variant="labeled" />
          </div>
        </div>
      </div>

      {lightboxIndex !== null ? (
        <PhotoLightbox
          images={resolved.lightboxUrls}
          lightboxIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
          dialogAriaLabel={t("groupLightboxTitle", { name: perfume.name })}
        />
      ) : null}
    </OrnamentalFrame>
  )
}
