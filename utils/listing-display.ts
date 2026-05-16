import type { DecantFormat, ListingCondition, TradePreference } from "@prisma/client"

export type ListingImageSource = {
  images?: string[] | null
  perfume?: { image?: string | null } | null
}

export const LISTING_CONDITIONS: ListingCondition[] = [
  "sealed",
  "mint",
  "lightlyUsed",
  "heavilyUsed",
  "damaged",
]

export const DECANT_FORMATS: DecantFormat[] = ["atomizer", "vial", "original"]

export const getPrimaryListingImage = (listing: ListingImageSource): string | null => {
  const first = listing.images?.find((url) => typeof url === "string" && url.trim())
  if (first) return first
  return listing.perfume?.image ?? null
}

export const isPartialListingAmount = (
  availableMl: number,
  maxMl: number | undefined
): boolean => {
  if (availableMl <= 0) return false
  if (maxMl === undefined || maxMl <= 0) return true
  return availableMl < maxMl
}

export const shouldShowDecantFields = (
  availableMl: number,
  maxMl: number | undefined
): boolean => isPartialListingAmount(availableMl, maxMl)

export const tradePreferenceChipLabel = (
  preference: TradePreference | string | null | undefined
): string => {
  switch (preference) {
    case "trade":
      return "Trade"
    case "both":
      return "Cash or trade"
    default:
      return "Cash"
  }
}

export const listingConditionI18nKey = (
  condition: ListingCondition
): string => `condition.${condition}`
