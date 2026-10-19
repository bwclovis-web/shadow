/** Shared Exchange browse / offers DTOs (safe for client + server). */

export type ExchangePreviewDto = {
  userPerfumeId: string
  userId: string
  url: string
  traderName: string
  condition: "sealed" | "mint" | "lightlyUsed" | "heavilyUsed" | "damaged" | null
  tradePreference: string | null
  tradeOnly: boolean
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string | null
  }
}

export type ExchangeFragranceGroupDto = {
  id: string
  name: string
  slug: string
  image: string | null
  perfumeHouse: {
    id: string
    name: string
    slug: string
  } | null
  offerCount: number
  collectorCount: number
  previews: ExchangePreviewDto[]
}

export type ExchangeFragranceGroupsPageMeta = {
  totalCount: number
  pageSize: number
  currentPage: number
  totalPages: number
  hasMore: boolean
  hasNextPage: boolean
  hasPrevPage: boolean
}

export type ExchangeOfferDto = {
  id: string
  perfumeId: string
  userId: string
  available: string
  amount: string
  price: string | null
  tradePrice: string | null
  tradePreference: string | null
  tradeOnly: boolean
  type: string | null
  images: string[]
  condition: "sealed" | "mint" | "lightlyUsed" | "heavilyUsed" | "damaged" | null
  decantFormat: "atomizer" | "vial" | "original" | null
  mlRemaining: number | null
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string | null
  }
}

export type ExchangeOffersPage = {
  offers: ExchangeOfferDto[]
  nextCursor: string | null
  pageSize: number
}
