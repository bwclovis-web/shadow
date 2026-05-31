"use client"

import { useTranslations } from "next-intl"
import Image from "next/image"
import { useState } from "react"
import { MdChevronLeft, MdChevronRight } from "react-icons/md"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import { Button } from "@/components/Atoms/Button/Button"
import Modal from "@/components/Organisms/Modal"
import { ListingImageBadges } from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { useSessionStore } from "@/hooks/sessionStore"
import { buildAttributedGallerySlides } from "@/utils/exchange-listing-photos"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

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
  const gallery = buildAttributedGallerySlides(listings)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const openModal = useSessionStore(state => state.openModal)

  if (gallery.length === 0) return null

  const openLightbox = () => {
    setLightboxIndex(0)
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
      <Button
        type="button"
        variant="link"
        size="sm"
        className={className}
        onClick={openLightbox}
      >
        {tListing("viewImages")}
      </Button>

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
