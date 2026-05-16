/** When false, listings may publish to the exchange without photos (IMP-044). */
export const isListingPhotoRequired = (): boolean =>
  process.env.LISTING_REQUIRE_PHOTO !== "false"
