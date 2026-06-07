"use client"

import type { ListingCondition } from "@prisma/client"
import { useTranslations } from "next-intl"
import Image from "next/image"

import { Button } from "@/components/Atoms/Button/Button"
import { PhotoLightbox } from "@/components/Molecules/PhotoLightbox/PhotoLightbox"
import { usePhotoLightbox } from "@/hooks/usePhotoLightbox"
import {
  getPrimaryListingImage,
  listingConditionI18nKey,
  tradePreferenceChipLabel,
} from "@/utils/listing-display"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

const THUMB_SIZE = 80
const LISTING_LIGHTBOX_MODAL_ID = "listing-photo-lightbox"

interface ListingPhotosProps {
  images?: string[] | null
  perfumeImage?: string | null
  condition?: ListingCondition | null
  tradePreference?: string | null
  tradeOnly?: boolean
  className?: string
  lightboxSize?: "default" | "large"
  trigger?: "thumbnails" | "button"
}

export const ListingImageBadges = ({
  condition,
  tradePreference,
  tradeOnly,
}: {
  condition?: ListingCondition | null
  tradePreference?: string | null
  tradeOnly?: boolean
}) => {
  const t = useTranslations("listing")
  const preference = tradeOnly ? "trade" : tradePreference

  return (
    <div className="flex flex-wrap gap-1">
      {condition && (
        <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-noir-dark/85 text-noir-gold border border-noir-gold/50">
          {t(listingConditionI18nKey(condition))}
        </span>
      )}
      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-noir-gold text-noir-black">
        {tradePreferenceChipLabel(preference)}
      </span>
    </div>
  )
}

const ListingPhotos = ({
  images,
  perfumeImage,
  condition,
  tradePreference,
  tradeOnly,
  className = "",
  lightboxSize = "default",
  trigger = "thumbnails",
}: ListingPhotosProps) => {
  const t = useTranslations("listing")
  const gallery =
    images && images.length > 0
      ? images
      : getPrimaryListingImage({ images, perfume: { image: perfumeImage } })
        ? [getPrimaryListingImage({ images, perfume: { image: perfumeImage } })!]
        : []

  const { lightboxIndex, openLightbox, closeLightbox, goPrev, goNext } =
    usePhotoLightbox({ imageCount: gallery.length, modalId: LISTING_LIGHTBOX_MODAL_ID })

  if (gallery.length === 0) return null

  return (
    <>
      {trigger === "button" ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={className}
          onClick={() => openLightbox(0)}
        >
          {t("viewImages")}
        </Button>
      ) : (
        <ul className={`flex flex-wrap gap-2 ${className}`}>
          {gallery.map((url, index) => {
            const src = normalizeRemoteImageSrc(url)
            if (!src) return null
            return (
              <li key={`${url}-${index}`}>
                <button
                  type="button"
                  className="relative block aspect-square cursor-pointer overflow-hidden rounded border border-noir-gold focus:outline-none focus:ring-2 focus:ring-noir-gold"
                  style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                  onClick={() => openLightbox(index)}
                  aria-label={t("openPhoto", { index: index + 1 })}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes={`${THUMB_SIZE}px`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {lightboxIndex !== null ? (
        <PhotoLightbox
          images={gallery}
          lightboxIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
          dialogAriaLabel={t("lightboxTitle")}
          lightboxSize={lightboxSize}
          footer={
            <ListingImageBadges
              condition={condition}
              tradePreference={tradePreference}
              tradeOnly={tradeOnly}
            />
          }
        />
      ) : null}
    </>
  )
}

export default ListingPhotos
