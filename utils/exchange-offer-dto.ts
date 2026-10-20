import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"

/** Map on-demand offer DTO to the listing row shape TradeComposer expects. */
export const offerDtoToUserPerfumeRow = (
  offer: ExchangeOfferDto
): ExchangeUserPerfumeRow => ({
  id: offer.id,
  userId: offer.userId,
  available: offer.available,
  type: offer.type,
  tradePreference: offer.tradePreference,
  tradeOnly: offer.tradeOnly,
  price: offer.price,
  tradePrice: offer.tradePrice,
  images: offer.images,
  condition: offer.condition,
  decantFormat: offer.decantFormat,
  mlRemaining: offer.mlRemaining,
  user: offer.user,
})
