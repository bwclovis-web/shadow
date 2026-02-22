import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getAvailablePerfumesForDecantingPaginated } from "@/models/perfume.server"

import TheExchangeClient from "./TheExchangeClient"

export const ROUTE_PATH = "/the-exchange"

const PAGE_SIZE = 16

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("tradingPost.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

type PageProps = {
  searchParams: Promise<{ q?: string; pg?: string }>
}

const TheExchangePage = async ({ searchParams }: PageProps) => {
  const params = await searchParams
  const pageParam = parseInt(params.pg ?? "1", 10)
  const searchQuery = (params.q ?? "").trim()
  const initialPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
  const initialSkip = (initialPage - 1) * PAGE_SIZE

  let { perfumes: availablePerfumes, meta: pagination } =
    await getAvailablePerfumesForDecantingPaginated({
      skip: initialSkip,
      take: PAGE_SIZE,
      search: searchQuery || undefined,
    })

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
    />
  )
}

export default TheExchangePage
