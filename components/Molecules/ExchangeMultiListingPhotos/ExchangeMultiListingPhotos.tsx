"use client"

import { useTranslations } from "next-intl"
import Image from "next/image"
import { useState } from "react"
import { MdChevronLeft, MdChevronRight } from "react-icons/md"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import Modal from "@/components/Organisms/Modal"
import { ListingImageBadges } from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { useSessionStore } from "@/hooks/sessionStore"
import {
  buildAttributedGallerySlides,
  getListingMosaicThumbs,
  MOSAIC_THUMB_MAX,
} from "@/utils/exchange-listing-photos"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

const MOSAIC_THUMB_SIZE = 56
const EXCHANGE_MULTI_LIGHTBOX_MODAL_ID = "exchange-multi-listing-lightbox"

type ExchangeMultiListingPhotosProps = {
  listings: ExchangeUserPerfumeRow[]
  className?: string
}

export const ExchangeMultiListingPhotos = ({
  listings,
  className = "",
}: ExchangeMultiListingPhotosProps) => {
  const t = useTranslations("tradingPost.listings")
  const tListing = useTranslations("listing")
  const mosaicThumbs = getListingMosaicThumbs(listings)
  const gallery = buildAttributedGallerySlides(listings)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const openModal = useSessionStore(state => state.openModal)

  if (mosaicThumbs.length === 0) return null

  const visibleThumbs = mosaicThumbs.slice(0, MOSAIC_THUMB_MAX)
  const overflowCount = mosaicThumbs.length - visibleThumbs.length

  const openLightboxAt = (mosaicIndex: number) => {
    const thumb = visibleThumbs[mosaicIndex]
    if (!thumb) return
    const galleryIndex = gallery.findIndex(
      slide => slide.userPerfumeId === thumb.userPerfumeId && slide.url === thumb.url
    )
    setLightboxIndex(galleryIndex >= 0 ? galleryIndex : 0)
    openModal(EXCHANGE_MULTI_LIGHTBOX_MODAL_ID)
  }

  const closeLightbox = () => {
    setLightboxIndex(null)
    const { modalId, closeModal } = useSessionStore.getState()
    if (modalId === EXCHANGE_MULTI_LIGHTBOX_MODAL_ID) {
      closeModal()
    }
  }

  const goPrev = () =>
    setLightboxIndex(current =>
      current === null ? null : (current - 1 + gallery.length) % gallery.length
    )
  const goNext = () =>
    setLightboxIndex(current =>
      current === null ? null : (current + 1) % gallery.length
    )

  const activeSlide = lightboxIndex !== null ? gallery[lightboxIndex] : null

  return (
    <>
      <div className={className}>
        <p className="text-xs text-noir-gold-500 mb-1.5">
          {t("photosFromListings", { count: mosaicThumbs.length })}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {visibleThumbs.map((thumb, index) => {
            const src = normalizeRemoteImageSrc(thumb.url)
            if (!src) return null
            const isLastVisible = index === visibleThumbs.length - 1
            return (
              <li key={`${thumb.userPerfumeId}-${thumb.url}`} className="relative">
                <button
                  type="button"
                  className="relative block aspect-square cursor-pointer overflow-hidden rounded border border-noir-gold focus:outline-none focus:ring-2 focus:ring-noir-gold"
                  style={{ width: MOSAIC_THUMB_SIZE, height: MOSAIC_THUMB_SIZE }}
                  onClick={() => openLightboxAt(index)}
                  aria-label={t("openListingPhoto", {
                    trader: thumb.traderName,
                    index: index + 1,
                  })}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes={`${MOSAIC_THUMB_SIZE}px`}
                  />
                </button>
                {isLastVisible && overflowCount > 0 ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-noir-black/65 text-xs font-semibold text-noir-gold">
                    +{overflowCount}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>

      {lightboxIndex !== null && activeSlide ? (
        <Modal
          innerType="dark"
          animateStart="top"
          dialogAriaLabel={t("multiLightboxTitle")}
          onClose={() => setLightboxIndex(null)}
        >
          <div className="relative p-2 sm:p-4 mx-auto w-full max-w-3xl">
            {gallery.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-noir-gold p-2"
                  onClick={goPrev}
                  aria-label={tListing("previousPhoto")}
                >
                  <MdChevronLeft size={32} />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-noir-gold p-2"
                  onClick={goNext}
                  aria-label={tListing("nextPhoto")}
                >
                  <MdChevronRight size={32} />
                </button>
              </>
            ) : null}
            <p className="text-center text-sm font-semibold text-noir-gold mb-2 px-8">
              {activeSlide.traderName}
            </p>
            <div
              className={`relative w-full ${gallery.length > 1 ? "mx-4 sm:mx-8" : ""} aspect-square max-h-[70vh]`}
            >
              {normalizeRemoteImageSrc(activeSlide.url) ? (
                <Image
                  src={normalizeRemoteImageSrc(activeSlide.url)!}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 90vw, 70vw"
                  priority
                />
              ) : null}
            </div>
            <div className="flex justify-center mt-3">
              <ListingImageBadges
                condition={activeSlide.condition}
                tradePreference={activeSlide.tradePreference}
                tradeOnly={activeSlide.tradeOnly}
              />
            </div>
            {gallery.length > 1 ? (
              <p className="mt-2 text-center text-xs text-noir-gold-500">
                {t("photoIndex", {
                  current: lightboxIndex + 1,
                  total: gallery.length,
                })}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-noir-gold-100 underline"
              onClick={closeLightbox}
            >
              {tListing("closeLightbox")}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
