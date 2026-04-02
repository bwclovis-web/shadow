import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getPerfumeHouseSummaryById } from "@/models/house.server"
import { getAvailablePerfumesForDecantingPaginated } from "@/models/perfume.server"
import { getPerfumeNotesByIds } from "@/models/tags.server"
import { parseDiscoveryFiltersFromSearchParams } from "@/utils/discovery-filters"

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

  const [perfumePage, initialNoteTags, initialHouse] = await Promise.all([
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

  return (
    <TheExchangeClient
      availablePerfumes={availablePerfumes}
      pagination={pagination}
      searchQuery={searchQuery}
      initialNoteTags={initialNoteTags}
      initialHouse={initialHouse}
    />
  )
}

export default TheExchangePage
