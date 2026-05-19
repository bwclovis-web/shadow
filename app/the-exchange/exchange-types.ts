import type { Tag } from "@/lib/queries/tags"
import type {
  ActivityFeedListingRow,
  FollowedActivityItem,
} from "@/models/activity-feed.server"
import type { SeasonalTrendingResult } from "@/models/seasonal-trending.server"
import type { WishlistExchangeMatchEnriched } from "@/services/trade-match"
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
  initialPerfume: { id: string; name: string } | null
  wishlistMatches?: WishlistExchangeMatchEnriched[]
  recentListings?: ActivityFeedListingRow[]
  followedActivity?: FollowedActivityItem[]
  seasonalTrending?: SeasonalTrendingResult
  traderReputationByUserId?: Record<string, TraderReputationV1>
  viewerId?: string | null
}
