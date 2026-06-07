"use client"

import { useTranslations } from "next-intl"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import { Button } from "@/components/Atoms/Button/Button"
import { ListingImageBadges } from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { PhotoLightbox } from "@/components/Molecules/PhotoLightbox/PhotoLightbox"
import { usePhotoLightbox } from "@/hooks/usePhotoLightbox"
import { buildAttributedGallerySlides } from "@/utils/exchange-listing-photos"

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
  const imageUrls = gallery.map(slide => slide.url)

  const { lightboxIndex, openLightbox, closeLightbox, goPrev, goNext } =
    usePhotoLightbox({
      imageCount: gallery.length,
      modalId: EXCHANGE_MULTI_LIGHTBOX_MODAL_ID,
    })

  if (gallery.length === 0) return null

  const activeSlide = lightboxIndex !== null ? gallery[lightboxIndex] : null

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className={className}
        onClick={() => openLightbox(0)}
      >
        {tListing("viewImages")}
      </Button>

      {lightboxIndex !== null && activeSlide ? (
        <PhotoLightbox
          images={imageUrls}
          lightboxIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
          dialogAriaLabel={t("multiLightboxTitle")}
          header={
            <p className="text-center text-sm font-semibold text-noir-gold mb-2 px-8">
              {activeSlide.traderName}
            </p>
          }
          footer={
            <ListingImageBadges
              condition={activeSlide.condition}
              tradePreference={activeSlide.tradePreference}
              tradeOnly={activeSlide.tradeOnly}
            />
          }
          indexLabel={
            gallery.length > 1
              ? t("photoIndex", {
                  current: lightboxIndex + 1,
                  total: gallery.length,
                })
              : undefined
          }
        />
      ) : null}
    </>
  )
}
