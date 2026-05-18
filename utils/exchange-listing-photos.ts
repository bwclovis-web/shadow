import type { ListingCondition } from "@prisma/client"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import { getPrimaryListingImage } from "@/utils/listing-display"
import { getTraderDisplayName } from "@/utils/user"

export type ExchangePerfumeCardSource = {
  id: string
  name: string
  slug: string
  image?: string | null
  perfumeHouse?: { name: string } | null
  userPerfume: ExchangeUserPerfumeRow[]
}

export type AttributedGallerySlide = {
  url: string
  userPerfumeId: string
  traderName: string
  condition: ListingCondition | null
  tradePreference: string | null
  tradeOnly: boolean
}

export const MOSAIC_THUMB_MAX = 4

/** Listings shown on exchange card photos (excludes viewer's own when logged in). */
export const getExchangeCardPhotoListings = (
  userPerfume: ExchangeUserPerfumeRow[],
  viewerId?: string | null
): ExchangeUserPerfumeRow[] => {
  if (!viewerId) return userPerfume
  return userPerfume.filter(up => up.userId !== viewerId)
}

export const listingHasUploadedPhotos = (listing: ExchangeUserPerfumeRow): boolean =>
  Boolean(listing.images?.some(url => typeof url === "string" && url.trim()))

export const countListingsWithUploadedPhotos = (
  listings: ExchangeUserPerfumeRow[]
): number => listings.filter(listingHasUploadedPhotos).length

/** One primary thumb per listing that has uploaded photos (not catalog fallback). */
export const getListingMosaicThumbs = (
  listings: ExchangeUserPerfumeRow[]
): AttributedGallerySlide[] =>
  listings
    .filter(listingHasUploadedPhotos)
    .map(listing => {
      const url = listing.images!.find(u => typeof u === "string" && u.trim())!.trim()
      return {
        url,
        userPerfumeId: listing.id,
        traderName: getTraderDisplayName(listing.user),
        condition: listing.condition,
        tradePreference: listing.tradePreference,
        tradeOnly: listing.tradeOnly,
      }
    })

/** Flat gallery for multi-listing lightbox (all uploaded photos, attributed per listing). */
export const buildAttributedGallerySlides = (
  listings: ExchangeUserPerfumeRow[]
): AttributedGallerySlide[] => {
  const slides: AttributedGallerySlide[] = []
  for (const listing of listings) {
    if (!listingHasUploadedPhotos(listing)) continue
    const traderName = getTraderDisplayName(listing.user)
    for (const raw of listing.images ?? []) {
      if (typeof raw !== "string" || !raw.trim()) continue
      slides.push({
        url: raw.trim(),
        userPerfumeId: listing.id,
        traderName,
        condition: listing.condition,
        tradePreference: listing.tradePreference,
        tradeOnly: listing.tradeOnly,
      })
    }
  }
  return slides
}

/** Hero image for LinkCard: listing primary when one tradeable listing, else catalog. */
export const getExchangeCardHeroImage = (
  catalogImage: string | null | undefined,
  photoListings: ExchangeUserPerfumeRow[]
): string | undefined => {
  if (photoListings.length === 1) {
    const primary = getPrimaryListingImage({
      images: photoListings[0]!.images,
      perfume: { image: catalogImage ?? null },
    })
    return primary ?? catalogImage ?? undefined
  }
  return catalogImage ?? undefined
}
