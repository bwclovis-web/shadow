/** Max ml for classifying a listing as a sample (exchange bottle-type filter). */
export const EXCHANGE_SAMPLE_MAX_ML = 10

/** Fragrance groups per Exchange browse page (fills 1/2/3-column grids). */
export const EXCHANGE_GROUP_PAGE_SIZE = 24

/** Browse sort tokens (`?sort=`). Default omitted from URLs. */
export const EXCHANGE_GROUP_SORTS = [
  "name-asc",
  "name-desc",
  "offers-newest",
] as const

export type ExchangeGroupSort = (typeof EXCHANGE_GROUP_SORTS)[number]

/** Matches mockup “Newest offers” — newest eligible listing `createdAt`. */
export const DEFAULT_EXCHANGE_GROUP_SORT: ExchangeGroupSort = "offers-newest"

export const parseExchangeGroupSort = (
  raw: string | null | undefined
): ExchangeGroupSort =>
  raw && (EXCHANGE_GROUP_SORTS as readonly string[]).includes(raw)
    ? (raw as ExchangeGroupSort)
    : DEFAULT_EXCHANGE_GROUP_SORT

/** Matching offers per on-demand page (View collectors / CTA). */
export const EXCHANGE_OFFER_PAGE_SIZE = 5

/** Attributed preview images per fragrance group. */
export const EXCHANGE_PREVIEW_IMAGE_MAX = 3

/**
 * Max distinct traders considered when applying `minRep` before pagination.
 * Reputation is computed in application code (not a DB column).
 */
export const EXCHANGE_MIN_REP_TRADER_CAP = 400
