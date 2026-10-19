import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { buildPageMetadata } from "@/lib/seo/metadata"
import { buildItemListJsonLd } from "@/lib/seo/json-ld"
import { getPerfumeHouseSummaryById } from "@/models/house.server"
import { getPerfumeById } from "@/models/perfume.server"
import { getExchangeFragranceGroupsPage } from "@/models/perfume-exchange-groups.server"
import { getCachedSeasonalTrendingPerfumes } from "@/models/seasonal-trending.server"
import { getExchangePalateRecommendations } from "@/models/exchange-palate.server"
import { getMutualTradeSuggestions } from "@/models/mutual-trade-suggestions.server"
import { getWishlistExchangeMatches } from "@/models/wishlist-matching.server"
import { getPerfumeNotesByIds } from "@/models/tags.server"
import { loadTraderReputationsForUserIds } from "@/services/reputation/loadReputationInputs.server"
import { listOpenSplitChipsForPerfumes } from "@/models/decant-split.server"
import { enrichWishlistExchangeMatches } from "@/services/trade-match"
import { isDecantSplitsEnabled } from "@/utils/decant-splits-enabled.server"
import {
  EXCHANGE_GROUP_PAGE_SIZE,
  parseExchangeGroupSort,
} from "@/utils/exchange-constants"
import {
  discoveryFiltersToSearchParams,
  parseDiscoveryFiltersFromSearchParams,
} from "@/utils/discovery-filters"
import { exchangeGroupToPageRow } from "@/utils/exchange-group-card"
import {
  parseExchangePreviewState,
  type ExchangePreviewState,
} from "@/utils/exchange-results-state"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { shouldShowAds } from "@/utils/ads/should-show-ads"

import TheExchangeClient from "./TheExchangeClient"
import type { ExchangePageData, ExchangePaginationMeta } from "./exchange-types"

const allowExchangeStatePreview = () =>
  process.env.NODE_ENV === "development" ||
  process.env.VERCEL_ENV === "preview"

const emptyGroupsPagination = (): ExchangePaginationMeta => ({
  totalCount: 0,
  pageSize: EXCHANGE_GROUP_PAGE_SIZE,
  currentPage: 1,
  totalPages: 0,
  hasMore: false,
  hasNextPage: false,
  hasPrevPage: false,
})

/**
 * Always dynamic: session, viewer exclusion, ads, and followed activity must not
 * share a public ISR cache.
 */
export const dynamic = "force-dynamic"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("tradingPost.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: "/the-exchange",
    ogImage: "/images/perfumes.png",
  })
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const TheExchangePage = async ({ searchParams }: PageProps) => {
  const params = await searchParams
  const pageParam = parseInt(
    typeof params.pg === "string" ? params.pg : (params.pg?.[0] ?? "1"),
    10
  )
  const searchQuery = (
    typeof params.q === "string" ? params.q : (params.q?.[0] ?? "")
  ).trim()
  const sortParam =
    typeof params.sort === "string"
      ? params.sort
      : (params.sort?.[0] ?? undefined)
  const sort = parseExchangeGroupSort(sortParam)
  const discovery = parseDiscoveryFiltersFromSearchParams(params)
  const initialPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const viewerId = session?.user?.id ?? null

  const filterQuery = discoveryFiltersToSearchParams(
    discovery,
    new URLSearchParams()
  )
  if (searchQuery) filterQuery.set("q", searchQuery)
  const filterQueryString = filterQuery.toString()

  const previewState: ExchangePreviewState | null = allowExchangeStatePreview()
    ? parseExchangePreviewState(params.previewState)
    : null

  const groupsPagePromise = getExchangeFragranceGroupsPage({
    page: initialPage,
    pageSize: EXCHANGE_GROUP_PAGE_SIZE,
    search: searchQuery || undefined,
    discovery,
    viewerId,
    sort,
  }).then(
    page => ({ ...page, loadFailed: false as const }),
    error => {
      console.error("[the-exchange] fragrance groups failed", error)
      return {
        groups: [],
        meta: emptyGroupsPagination(),
        loadFailed: true as const,
      }
    }
  )

  const [
    groupsOutcome,
    initialNoteTags,
    initialHouse,
    initialPerfume,
    wishlistMatches,
    seasonalTrending,
    palateRecommendations,
    mutualSwapSuggestions,
  ] = await Promise.all([
    groupsPagePromise,
    discovery.noteIds.length > 0
      ? getPerfumeNotesByIds(discovery.noteIds)
      : Promise.resolve([]),
    discovery.houseId
      ? getPerfumeHouseSummaryById(discovery.houseId)
      : Promise.resolve(null),
    discovery.perfumeId
      ? getPerfumeById(discovery.perfumeId).then(p =>
          p ? { id: p.id, name: p.name } : null
        )
      : Promise.resolve(null),
    viewerId ? getWishlistExchangeMatches(viewerId) : Promise.resolve([]),
    getCachedSeasonalTrendingPerfumes(10),
    viewerId
      ? getExchangePalateRecommendations(viewerId).catch(error => {
          console.error("[the-exchange] palate recommendations failed", error)
          return []
        })
      : Promise.resolve([]),
    viewerId ? getMutualTradeSuggestions(viewerId) : Promise.resolve([]),
  ])

  const loadFailed = groupsOutcome.loadFailed
  const availablePerfumes =
    previewState === "no-inventory" ||
    previewState === "zero-matches" ||
    previewState === "failure" ||
    loadFailed
      ? []
      : groupsOutcome.groups.map(exchangeGroupToPageRow)
  const pagination =
    previewState === "no-inventory" ||
    previewState === "zero-matches" ||
    previewState === "failure" ||
    loadFailed
      ? emptyGroupsPagination()
      : groupsOutcome.meta

  const traderIds = [
    ...new Set(
      [
        ...availablePerfumes.flatMap(p => p.userPerfume.map(up => up.userId)),
        ...wishlistMatches.flatMap(p => p.userPerfume.map(up => up.userId)),
        ...palateRecommendations.map(m => m.counterpartyId),
      ].filter(Boolean)
    ),
  ]
  const reputationMap =
    traderIds.length > 0
      ? await loadTraderReputationsForUserIds(traderIds)
      : new Map()
  const traderReputationByUserId = Object.fromEntries(reputationMap)

  const enrichedWishlistMatches =
    viewerId && wishlistMatches.length > 0
      ? await enrichWishlistExchangeMatches(
          viewerId,
          wishlistMatches,
          traderReputationByUserId
        )
      : []

  const perfumeIdsForSplits = availablePerfumes.map(p => p.id)
  const openSplitChips = isDecantSplitsEnabled()
    ? await listOpenSplitChipsForPerfumes(perfumeIdsForSplits)
    : []
  const openSplitChipsByPerfumeId = openSplitChips.reduce<
    Record<string, typeof openSplitChips>
  >((acc, chip) => {
    const list = acc[chip.perfumeId] ?? []
    list.push(chip)
    acc[chip.perfumeId] = list
    return acc
  }, {})

  return (
    <>
      {availablePerfumes.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildItemListJsonLd({
                name: "Perfumes available on The Exchange",
                path: "/the-exchange",
                items: availablePerfumes.map(p => ({
                  name: p.name,
                  path: `/perfume/${p.slug}`,
                })),
              })
            ),
          }}
        />
      ) : null}
      <TheExchangeClient
        availablePerfumes={
          availablePerfumes as ExchangePageData["availablePerfumes"]
        }
        pagination={pagination}
        searchQuery={searchQuery}
        sort={sort}
        filterQueryString={filterQueryString}
        initialNoteTags={initialNoteTags}
        initialHouse={initialHouse}
        initialPerfume={initialPerfume}
        wishlistMatches={enrichedWishlistMatches}
        seasonalTrending={seasonalTrending}
        traderReputationByUserId={traderReputationByUserId}
        viewerId={viewerId}
        openSplitChipsByPerfumeId={openSplitChipsByPerfumeId}
        palateRecommendations={palateRecommendations}
        mutualSwapSuggestions={mutualSwapSuggestions}
        showAds={shouldShowAds(session?.user)}
        loadFailed={loadFailed || previewState === "failure"}
        previewState={previewState}
      />
    </>
  )
}

export default TheExchangePage
