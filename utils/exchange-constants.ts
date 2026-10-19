/** Max ml for classifying a listing as a sample (exchange bottle-type filter). */
export const EXCHANGE_SAMPLE_MAX_ML = 10

/** Fragrance groups per Exchange browse page (fills 1/2/3-column grids). */
export const EXCHANGE_GROUP_PAGE_SIZE = 24

/** Matching offers per on-demand page (View collectors / CTA). */
export const EXCHANGE_OFFER_PAGE_SIZE = 5

/** Attributed preview images per fragrance group. */
export const EXCHANGE_PREVIEW_IMAGE_MAX = 3

/**
 * Max distinct traders considered when applying `minRep` before pagination.
 * Reputation is computed in application code (not a DB column).
 */
export const EXCHANGE_MIN_REP_TRADER_CAP = 400
