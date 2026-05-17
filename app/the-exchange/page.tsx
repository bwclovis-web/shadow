import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getPerfumeHouseSummaryById } from "@/models/house.server"
import {
  getAvailablePerfumesForDecantingPaginated,
  getPerfumeById,
} from "@/models/perfume.server"
import { getRecentlyListedActivity } from "@/models/activity-feed.server"
import { getSeasonalTrendingPerfumes } from "@/models/seasonal-trending.server"
import { getWishlistExchangeMatches } from "@/models/wishlist-matching.server"
import { getPerfumeNotesByIds } from "@/models/tags.server"
import { loadTraderReputationsForUserIds } from "@/services/reputation/loadReputationInputs.server"
import { parseDiscoveryFiltersFromSearchParams } from "@/utils/discovery-filters"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import TheExchangeClient from "./TheExchangeClient"

export const revalidate = 60

const PAGE_SIZE = 16

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("tradingPost.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
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
    seasonalTrending,
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
      getSeasonalTrendingPerfumes(10),
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
      [...availablePerfumes, ...wishlistMatches].flatMap(p =>
        p.userPerfume.map(up => up.userId)
      )
    ),
  ]
  const reputationMap =
    traderIds.length > 0 ? await loadTraderReputationsForUserIds(traderIds) : new Map()
  const traderReputationByUserId = Object.fromEntries(reputationMap)

  return (
    <TheExchangeClient
      availablePerfumes={availablePerfumes}
      pagination={pagination}
      searchQuery={searchQuery}
      initialNoteTags={initialNoteTags}
      initialHouse={initialHouse}
      initialPerfume={initialPerfume}
      wishlistMatches={wishlistMatches}
      recentListings={recentListings}
      seasonalTrending={seasonalTrending}
      traderReputationByUserId={traderReputationByUserId}
      viewerId={viewerId}
    />
  )
}

export default TheExchangePage
