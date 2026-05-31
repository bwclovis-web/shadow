"use client"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { ExchangeMultiListingPhotos } from "@/components/Molecules/ExchangeMultiListingPhotos/ExchangeMultiListingPhotos"

type ExchangeCardPhotosProps = {
  listings: ExchangeUserPerfumeRow[]
  catalogImage?: string | null
  className?: string
}

export const ExchangeCardPhotos = ({
  listings,
  catalogImage,
  className = "",
}: ExchangeCardPhotosProps) => {
  if (listings.length === 0) return null

  if (listings.length === 1) {
    const listing = listings[0]!
    return (
      <ListingPhotos
        images={listing.images}
        perfumeImage={catalogImage}
        condition={listing.condition}
        tradePreference={listing.tradePreference}
        tradeOnly={listing.tradeOnly}
        className={className}
        lightboxSize="default"
        trigger="button"
      />
    )
  }

  return (
    <ExchangeMultiListingPhotos listings={listings} className={className} />
  )
}
