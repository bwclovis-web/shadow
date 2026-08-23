import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { buildPageMetadata } from "@/lib/seo/metadata"
import { buildItemListJsonLd } from "@/lib/seo/json-ld"
import { getPerfumeHouseSummaryById } from "@/models/house.server"
import {
  getAvailablePerfumesForDecantingPaginated,
  getPerfumeById,
} from "@/models/perfume.server"
import { getFollowedActivity, getRecentlyListedActivity } from "@/models/activity-feed.server"
import { getSeasonalTrendingPerfumes } from "@/models/seasonal-trending.server"
import { getExchangePalateRecommendations } from "@/models/exchange-palate.server"
import { getMutualTradeSuggestions } from "@/models/mutual-trade-suggestions.server"
import { getWishlistExchangeMatches } from "@/models/wishlist-matching.server"
import { getPerfumeNotesByIds } from "@/models/tags.server"
import { loadTraderReputationsForUserIds } from "@/services/reputation/loadReputationInputs.server"
import { listOpenSplitChipsForPerfumes } from "@/models/decant-split.server"
import { enrichWishlistExchangeMatches } from "@/services/trade-match"
import { isDecantSplitsEnabled } from "@/utils/decant-splits-enabled.server"
import { parseDiscoveryFiltersFromSearchParams } from "@/utils/discovery-filters"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import TheExchangeClient from "./TheExchangeClient"
import type { ExchangePageData } from "./exchange-types"

export const revalidate = 60

const PAGE_SIZE = 16

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
  const discovery = parseDiscoveryFiltersFromSearchParams(params)
  const initialPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
  const initialSkip = (initialPage - 1) * PAGE_SIZE

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, { includeUser: true })
  const viewerId = session?.user?.id ?? null

  const [
    perfumePage,
    initialNoteTags,
    initialHouse,
    initialPerfume,
    wishlistMatches,
    recentListings,
    followedActivity,
    seasonalTrending,
    palateRecommendations,
    mutualSwapSuggestions,
  ] = await Promise.all([
      getAvailablePerfumesForDecantingPaginated({
        skip: initialSkip,
        take: PAGE_SIZE,
        search: searchQuery || undefined,
        discovery,
      }),
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
      viewerId
        ? getWishlistExchangeMatches(viewerId)
        : Promise.resolve([]),
      getRecentlyListedActivity(12),
      viewerId ? getFollowedActivity(viewerId, 12) : Promise.resolve([]),
      getSeasonalTrendingPerfumes(10),
      viewerId
        ? getExchangePalateRecommendations(viewerId).catch(error => {
            console.error("[the-exchange] palate recommendations failed", error)
            return []
          })
        : Promise.resolve([]),
      viewerId ? getMutualTradeSuggestions(viewerId) : Promise.resolve([]),
    ])

  let { perfumes: availablePerfumes, meta: pagination } = perfumePage

  const needsRefetch =
    pagination.totalCount > 0 &&
    availablePerfumes.length === 0 &&
    pagination.totalPages > 0 &&
    initialSkip >= pagination.totalCount

  if (needsRefetch) {
    const lastPage = pagination.totalPages
    const adjustedSkip = (lastPage - 1) * PAGE_SIZE
    const adjusted = await getAvailablePerfumesForDecantingPaginated({
      skip: adjustedSkip,
      take: PAGE_SIZE,
      search: searchQuery || undefined,
      discovery,
    })
    availablePerfumes = adjusted.perfumes
    pagination = adjusted.meta
  }

  if (pagination.totalCount === 0) {
    pagination = {
      ...pagination,
      currentPage: 1,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
      hasMore: false,
    }
  }

  const traderIds = [
    ...new Set(
      [
        ...availablePerfumes,
        ...wishlistMatches,
        ...palateRecommendations.map(m => ({
          userPerfume: [{ userId: m.counterpartyId }],
        })),
      ].flatMap(p => p.userPerfume.map(up => up.userId))
    ),
  ]
  const reputationMap =
    traderIds.length > 0 ? await loadTraderReputationsForUserIds(traderIds) : new Map()
  const traderReputationByUserId = Object.fromEntries(reputationMap)

  if (discovery.minRep != null) {
    const min = discovery.minRep
    availablePerfumes = availablePerfumes.filter(perfume =>
      perfume.userPerfume.some(up => {
        const score = traderReputationByUserId[up.userId]?.score
        return score != null && score >= min
      })
    )
  }

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
              }),
            ),
          }}
        />
      ) : null}
      <TheExchangeClient
      availablePerfumes={
        availablePerfumes as unknown as ExchangePageData["availablePerfumes"]
      }
      pagination={pagination}
      searchQuery={searchQuery}
      initialNoteTags={initialNoteTags}
      initialHouse={initialHouse}
      initialPerfume={initialPerfume}
      wishlistMatches={enrichedWishlistMatches}
      recentListings={recentListings}
      followedActivity={followedActivity}
      seasonalTrending={seasonalTrending}
      traderReputationByUserId={traderReputationByUserId}
      viewerId={viewerId}
      openSplitChipsByPerfumeId={openSplitChipsByPerfumeId}
      palateRecommendations={palateRecommendations}
      mutualSwapSuggestions={mutualSwapSuggestions}
    />
    </>
  )
}

export default TheExchangePage
