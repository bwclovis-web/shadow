"use client"

import type { ListingCondition } from "@prisma/client"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { useState } from "react"
import { MdChevronLeft, MdChevronRight } from "react-icons/md"

import Modal from "@/components/Organisms/Modal"
import { useSessionStore } from "@/hooks/sessionStore"
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
}: ListingPhotosProps) => {
  const t = useTranslations("listing")
  const gallery =
    images && images.length > 0
      ? images
      : getPrimaryListingImage({ images, perfume: { image: perfumeImage } })
        ? [getPrimaryListingImage({ images, perfume: { image: perfumeImage } })!]
        : []

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const openModal = useSessionStore((state) => state.openModal)

  if (gallery.length === 0) return null

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    openModal(LISTING_LIGHTBOX_MODAL_ID)
  }

  const closeLightbox = () => {
    setLightboxIndex(null)
    const { modalId, closeModal } = useSessionStore.getState()
    if (modalId === LISTING_LIGHTBOX_MODAL_ID) {
      closeModal()
    }
  }
  const goPrev = () =>
    setLightboxIndex((current) =>
      current === null ? null : (current - 1 + gallery.length) % gallery.length
    )
  const goNext = () =>
    setLightboxIndex((current) =>
      current === null ? null : (current + 1) % gallery.length
    )

  return (
    <>
      <ul className={`flex flex-wrap gap-2 ${className}`}>
        {gallery.map((url, index) => {
          const src = normalizeRemoteImageSrc(url)
          if (!src) return null
          return (
            <li key={`${url}-${index}`}>
              <button
                type="button"
                className="relative block overflow-hidden rounded border border-noir-gold/40 focus:outline-none focus:ring-2 focus:ring-noir-gold"
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
                {index === 0 && (condition || tradePreference || tradeOnly) && (
                  <span className="absolute bottom-0 left-0 right-0 p-0.5 bg-gradient-to-t from-noir-dark/90 to-transparent">
                    <ListingImageBadges
                      condition={condition}
                      tradePreference={tradePreference}
                      tradeOnly={tradeOnly}
                    />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {lightboxIndex !== null && (
        <Modal
          innerType="dark"
          animateStart="top"
          dialogAriaLabel={t("lightboxTitle")}
          onClose={() => setLightboxIndex(null)}
          className={
            lightboxSize === "large"
              ? "!w-[min(98vw,80rem)] !max-w-[min(98vw,80rem)] !max-h-[96dvh]"
              : undefined
          }
        >
          <div
            className={`relative p-2 sm:p-4 mx-auto w-full ${
              lightboxSize === "large" ? "max-w-full" : "max-w-3xl"
            }`}
          >
            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-noir-gold p-2"
                  onClick={goPrev}
                  aria-label={t("previousPhoto")}
                >
                  <MdChevronLeft size={32} />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-noir-gold p-2"
                  onClick={goNext}
                  aria-label={t("nextPhoto")}
                >
                  <MdChevronRight size={32} />
                </button>
              </>
            )}
            <div
              className={`relative w-full ${gallery.length > 1 ? "mx-4 sm:mx-8" : ""} ${
                lightboxSize === "large"
                  ? "h-[min(88vh,920px)] min-h-[55vh] w-full"
                  : "aspect-square max-h-[70vh]"
              }`}
            >
              {normalizeRemoteImageSrc(gallery[lightboxIndex]) && (
                <Image
                  src={normalizeRemoteImageSrc(gallery[lightboxIndex])!}
                  alt=""
                  fill
                  className="object-contain"
                  sizes={
                    lightboxSize === "large"
                      ? "(max-width: 768px) 98vw, 80rem"
                      : "(max-width: 768px) 90vw, 70vw"
                  }
                  priority
                />
              )}
            </div>
            <div className="flex justify-center mt-3">
              <ListingImageBadges
                condition={condition}
                tradePreference={tradePreference}
                tradeOnly={tradeOnly}
              />
            </div>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-noir-gold-100 underline"
              onClick={closeLightbox}
            >
              {t("closeLightbox")}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

export default ListingPhotos
