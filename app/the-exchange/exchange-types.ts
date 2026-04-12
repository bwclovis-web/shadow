import type { Tag } from "@/lib/queries/tags"
import type { TraderReputationV1 } from "@/services/reputation/types"

export type ExchangePaginationMeta = {
  totalCount: number
  pageSize: number
  currentPage: number
  totalPages: number
  hasMore: boolean
  hasNextPage: boolean
  hasPrevPage: boolean
}

export type ExchangeUserPerfumeRow = {
  id: string
  userId: string
  available: string
  type: string | null
  tradePreference: string | null
  tradeOnly: boolean
  price: string | null
  tradePrice: string | null
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string | null
  }
}

export type ExchangePerfumeRow = {
  id: string
  name: string
  slug: string
  image?: string | null
  perfumeHouse?: { id: string; name: string; slug: string; type: string } | null
  userPerfume: ExchangeUserPerfumeRow[]
}

export type ExchangePageData = {
  availablePerfumes: ExchangePerfumeRow[]
  pagination: ExchangePaginationMeta
  searchQuery: string
  initialNoteTags: Tag[]
  initialHouse: { id: string; name: string } | null
  traderReputationByUserId?: Record<string, TraderReputationV1>
}
