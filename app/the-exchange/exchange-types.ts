import type { Tag } from "@/lib/queries/tags"
import type { SeasonalTrendingResult } from "@/models/seasonal-trending.server"
import type { WishlistExchangeMatchEnriched } from "@/services/trade-match"
import type { OnboardingTraderMatchEnriched } from "@/services/trade-match"
import type { MutualTradeSuggestion } from "@/models/mutual-trade-suggestions.server"
import type { TraderReputationV1 } from "@/services/reputation/types"
import type { OpenSplitChip } from "@/types/decant-split"
import type { ExchangeGroupSort } from "@/utils/exchange-constants"
import type { ExchangePreviewState } from "@/utils/exchange-results-state"

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
  /** Preview stubs only on browse (≤3); full offers load on demand. */
  userPerfume: ExchangeUserPerfumeRow[]
  offerCount: number
  collectorCount: number
}

export type ExchangePageData = {
  availablePerfumes: ExchangePerfumeRow[]
  pagination: ExchangePaginationMeta
  searchQuery: string
  sort: ExchangeGroupSort
  /** Current URL search string without `pg` — used for offer query keys. */
  filterQueryString: string
  initialNoteTags: Tag[]
  initialHouse: { id: string; name: string } | null
  initialPerfume: { id: string; name: string } | null
  wishlistMatches?: WishlistExchangeMatchEnriched[]
  palateRecommendations?: OnboardingTraderMatchEnriched[]
  mutualSwapSuggestions?: MutualTradeSuggestion[]
  seasonalTrending?: SeasonalTrendingResult
  traderReputationByUserId?: Record<string, TraderReputationV1>
  viewerId?: string | null
  openSplitChipsByPerfumeId?: Record<string, OpenSplitChip[]>
  showAds?: boolean
  /** True when the fragrance-group query threw; never present as zero matches. */
  loadFailed?: boolean
  /**
   * Controlled UI fixture for local/preview QA (`?previewState=`).
   * Ignored in production deployments.
   */
  previewState?: ExchangePreviewState | null
}
