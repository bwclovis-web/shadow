export const LISTING_PUBLISH_ERROR_CODES = {
  photoRequired: "photoRequired",
} as const

export type ListingPublishErrorCode =
  (typeof LISTING_PUBLISH_ERROR_CODES)[keyof typeof LISTING_PUBLISH_ERROR_CODES]
