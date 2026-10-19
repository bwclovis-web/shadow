import type {
  ExchangePerfumeRow,
  ExchangeUserPerfumeRow,
} from "@/app/the-exchange/exchange-types"
import type { ExchangeFragranceGroupDto } from "@/types/exchange-discovery"
import type { ExchangePerfumeCardSource } from "@/utils/exchange-listing-photos"

/**
 * Maps a narrow fragrance group DTO onto the shape current Exchange cards expect.
 * Preview listings (≤3) populate photos; CTA should load offers on demand.
 */
export const exchangeGroupToCardSource = (
  group: ExchangeFragranceGroupDto
): ExchangePerfumeCardSource => ({
  id: group.id,
  name: group.name,
  slug: group.slug,
  image: group.image,
  perfumeHouse: group.perfumeHouse
    ? { name: group.perfumeHouse.name }
    : null,
  userPerfume: group.previews.map(previewToUserPerfumeRow),
})

/** Full page row including counts for client summary/CTA wiring. */
export const exchangeGroupToPageRow = (
  group: ExchangeFragranceGroupDto
): ExchangePerfumeRow & {
  offerCount: number
  collectorCount: number
} => ({
  id: group.id,
  name: group.name,
  slug: group.slug,
  image: group.image,
  perfumeHouse: group.perfumeHouse
    ? { ...group.perfumeHouse, type: "" }
    : null,
  userPerfume: group.previews.map(previewToUserPerfumeRow),
  offerCount: group.offerCount,
  collectorCount: group.collectorCount,
})

const previewToUserPerfumeRow = (
  preview: ExchangeFragranceGroupDto["previews"][number]
): ExchangeUserPerfumeRow => ({
  id: preview.userPerfumeId,
  userId: preview.userId,
  available: "1",
  type: null,
  tradePreference: preview.tradePreference,
  tradeOnly: preview.tradeOnly,
  price: null,
  tradePrice: null,
  images: [preview.url],
  condition: preview.condition,
  decantFormat: null,
  mlRemaining: null,
  user: preview.user,
})
