"use client"

import LinkCard from "@/components/Organisms/LinkCard"
import { ListingImageBadges } from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { ExchangeCardPhotos } from "@/components/Molecules/ExchangeCardPhotos"
import {
  getExchangeCardHeroImage,
  getExchangeCardPhotoListings,
  type ExchangePerfumeCardSource,
} from "@/utils/exchange-listing-photos"

type ExchangePerfumeCardProps = {
  perfume: ExchangePerfumeCardSource
  viewerId?: string | null
  imagePriority?: boolean
  children?: React.ReactNode
}

export const ExchangePerfumeCard = ({
  perfume,
  viewerId = null,
  imagePriority = false,
  children,
}: ExchangePerfumeCardProps) => {
  const photoListings = getExchangeCardPhotoListings(perfume.userPerfume, viewerId)
  const heroImage = getExchangeCardHeroImage(perfume.image, photoListings)
  const singleListing = photoListings.length === 1 ? photoListings[0]! : null

  return (
    <LinkCard
      data={{
        id: perfume.id,
        name: perfume.name,
        slug: perfume.slug,
        image: heroImage,
        perfumeHouse: perfume.perfumeHouse
          ? { name: perfume.perfumeHouse.name }
          : undefined,
      }}
      type="perfume"
      imagePriority={imagePriority}
      imageOverlay={
        singleListing ? (
          <ListingImageBadges
            condition={singleListing.condition}
            tradePreference={singleListing.tradePreference}
            tradeOnly={singleListing.tradeOnly}
          />
        ) : undefined
      }
    >
      <div className="space-y-2">
        <ExchangeCardPhotos
          listings={photoListings}
          catalogImage={perfume.image}
        />
        {children}
      </div>
    </LinkCard>
  )
}
