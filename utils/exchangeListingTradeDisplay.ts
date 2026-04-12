/** Minimal listing fields for trade/price display (matches trader profile ItemsToTrade logic). */
export type ExchangeListingTradeInput = {
  tradePreference: string | null
  tradeOnly: boolean
  price: string | null | undefined
  tradePrice: string | null | undefined
}

export type ExchangeListingTradePreference = "cash" | "trade" | "both"

export const getExchangeListingTradeDisplay = (
  listing: ExchangeListingTradeInput
) => {
  const preference = (listing.tradePreference || "cash") as ExchangeListingTradePreference
  const showPrice =
    !listing.tradeOnly &&
    (preference === "cash" || preference === "both") &&
    Boolean(listing.price?.trim())
  const showTradePrice =
    !listing.tradeOnly && Boolean(listing.tradePrice?.trim())
  return { preference, showPrice, showTradePrice }
}
