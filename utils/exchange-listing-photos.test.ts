import { describe, expect, it } from "vitest"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"

import {
  buildAttributedGallerySlides,
  countListingsWithUploadedPhotos,
  getExchangeCardHeroImage,
  getExchangeCardPhotoListings,
  getListingMosaicThumbs,
  listingHasUploadedPhotos,
} from "./exchange-listing-photos"

const baseUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  username: null,
  email: "ada@example.com",
}

const listing = (
  overrides: Partial<ExchangeUserPerfumeRow> & Pick<ExchangeUserPerfumeRow, "id" | "userId">
): ExchangeUserPerfumeRow => ({
  available: "10",
  type: "decant",
  tradePreference: "both",
  tradeOnly: false,
  price: null,
  tradePrice: null,
  images: [],
  condition: "mint",
  decantFormat: null,
  mlRemaining: null,
  user: baseUser,
  ...overrides,
})

describe("exchange-listing-photos", () => {
  it("filters viewer from card photo listings", () => {
    const rows = [
      listing({ id: "a", userId: "viewer" }),
      listing({ id: "b", userId: "other" }),
    ]
    expect(getExchangeCardPhotoListings(rows, "viewer")).toHaveLength(1)
    expect(getExchangeCardPhotoListings(rows, null)).toHaveLength(2)
  })

  it("uses listing primary for single photo listing hero", () => {
    const rows = [
      listing({
        id: "a",
        userId: "u1",
        images: ["https://cdn.example.com/listing.jpg"],
      }),
    ]
    expect(getExchangeCardHeroImage("/catalog.jpg", rows)).toBe(
      "https://cdn.example.com/listing.jpg"
    )
  })

  it("uses catalog hero when multiple listings", () => {
    const rows = [
      listing({ id: "a", userId: "u1", images: ["https://cdn.example.com/a.jpg"] }),
      listing({ id: "b", userId: "u2", images: ["https://cdn.example.com/b.jpg"] }),
    ]
    expect(getExchangeCardHeroImage("/catalog.jpg", rows)).toBe("/catalog.jpg")
  })

  it("builds mosaic thumbs only for uploaded photos", () => {
    const rows = [
      listing({ id: "a", userId: "u1", images: ["https://cdn.example.com/a.jpg"] }),
      listing({ id: "b", userId: "u2", images: [] }),
    ]
    expect(getListingMosaicThumbs(rows)).toHaveLength(1)
    expect(countListingsWithUploadedPhotos(rows)).toBe(1)
    expect(listingHasUploadedPhotos(rows[1]!)).toBe(false)
  })

  it("builds flat attributed gallery across listings", () => {
    const rows = [
      listing({
        id: "a",
        userId: "u1",
        images: ["https://cdn.example.com/a1.jpg", "https://cdn.example.com/a2.jpg"],
      }),
      listing({ id: "b", userId: "u2", images: ["https://cdn.example.com/b.jpg"] }),
    ]
    const slides = buildAttributedGallerySlides(rows)
    expect(slides).toHaveLength(3)
    expect(slides[0]?.traderName).toBe("Ada Lovelace")
    expect(slides[2]?.url).toBe("https://cdn.example.com/b.jpg")
  })
})
