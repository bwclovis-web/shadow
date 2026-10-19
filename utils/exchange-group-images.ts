import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

/** Neutral bottle placeholder when seller and catalog images are missing. */
export const EXCHANGE_NEUTRAL_FALLBACK_IMAGE = "/images/single-bottle.webp"

export type ExchangeGroupImageKind = "seller" | "catalog" | "fallback"

export type ExchangeGroupImageSlot = {
  src: string
  kind: ExchangeGroupImageKind
  userPerfumeId?: string
  traderName?: string
  condition: ExchangeUserPerfumeRow["condition"]
  tradePreference: string | null
  tradeOnly: boolean
}

export type ExchangeGroupImageLayout = "simple" | "mosaic"

export type ResolvedExchangeGroupImages = {
  main: ExchangeGroupImageSlot
  /** Up to two attributed seller thumbs beside the main photo. */
  sides: ExchangeGroupImageSlot[]
  layout: ExchangeGroupImageLayout
  /** URLs for on-demand lightbox (seller first, then catalog if used as main). */
  lightboxUrls: string[]
}

type GroupImageSource = {
  image?: string | null
  userPerfume: ExchangeUserPerfumeRow[]
}

const sellerSlotsFromListings = (
  listings: ExchangeUserPerfumeRow[]
): ExchangeGroupImageSlot[] => {
  const slots: ExchangeGroupImageSlot[] = []
  for (const listing of listings) {
    for (const raw of listing.images ?? []) {
      const src = normalizeRemoteImageSrc(raw)
      if (!src) continue
      slots.push({
        src,
        kind: "seller",
        userPerfumeId: listing.id,
        traderName: undefined,
        condition: listing.condition,
        tradePreference: listing.tradePreference,
        tradeOnly: listing.tradeOnly,
      })
      break // one primary thumb per listing
    }
  }
  return slots
}

/**
 * Main photo + up to 2 side previews. Seller → catalog → neutral fallback.
 * One image uses a simple layout; 2+ seller thumbs use mosaic.
 */
export const resolveExchangeGroupImages = (
  source: GroupImageSource
): ResolvedExchangeGroupImages => {
  const sellerSlots = sellerSlotsFromListings(source.userPerfume).slice(0, 3)
  const catalogSrc = normalizeRemoteImageSrc(source.image ?? null)

  if (sellerSlots.length === 0) {
    const main: ExchangeGroupImageSlot = catalogSrc
      ? {
          src: catalogSrc,
          kind: "catalog",
          condition: null,
          tradePreference: null,
          tradeOnly: false,
        }
      : {
          src: EXCHANGE_NEUTRAL_FALLBACK_IMAGE,
          kind: "fallback",
          condition: null,
          tradePreference: null,
          tradeOnly: false,
        }
    return {
      main,
      sides: [],
      layout: "simple",
      lightboxUrls: [main.src],
    }
  }

  if (sellerSlots.length === 1) {
    const main = sellerSlots[0]!
    return {
      main,
      sides: [],
      layout: "simple",
      lightboxUrls: [main.src],
    }
  }

  const main = sellerSlots[0]!
  const sides = sellerSlots.slice(1, 3)
  return {
    main,
    sides,
    layout: "mosaic",
    lightboxUrls: [main.src, ...sides.map(s => s.src)],
  }
}
