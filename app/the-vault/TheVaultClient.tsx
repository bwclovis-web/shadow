"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import AlphabeticalNav from "@/components/Organisms/AlphabeticalNav"
import DataDisplaySection from "@/components/Organisms/DataDisplaySection"
import DataFilters from "@/components/Organisms/DataFilters"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { useInfinitePagination } from "@/hooks/useInfinitePagination"
import { useInfinitePerfumesByLetter } from "@/hooks/useInfinitePerfumes"
import { useResponsivePageSize } from "@/hooks/useMediaQuery"
import {
  usePaginatedNavigation,
  usePreserveScrollPosition,
} from "@/hooks/usePaginatedNavigation"
import { useScrollToDataList } from "@/hooks/useScrollToDataList"
import { useSyncPaginationUrl } from "@/hooks/useSyncPaginationUrl"
import {
  getDefaultSortOptions,
  sortItems,
  type SortOption,
} from "@/utils/sortUtils"

const ROUTE_PATH = "/the-vault"
const BANNER_IMAGE = "/images/vault.webp"
const SINGLE_LETTER_REGEX = /^[A-Za-z]$/

export type TheVaultClientProps = {
  initialLetter?: string | null
  initialPerfumes?: PerfumeFromApi[]
  initialPerfumeTotal?: number
}

type PerfumeFromApi = {
  id: string
  name: string
  slug: string
  createdAt?: Date | string
  updatedAt?: Date | string
  type?: string
  image?: string
  perfumeHouse?: { name: string }
}

const parseLetterFromParam = (param: unknown): string | null => {
  if (typeof param !== "string" || !SINGLE_LETTER_REGEX.test(param)) return null
  return param.toUpperCase()
}

const TheVaultClient = ({
  initialLetter = null,
  initialPerfumes = [],
  initialPerfumeTotal = 0,
}: TheVaultClientProps = {}) => {
  const t = useTranslations("allPerfumes")
  const tSort = useTranslations("sortOptions")
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [selectedSort, setSelectedSort] = useState<SortOption>("created-desc")

  const pageSize = useResponsivePageSize()
  const letterFromUrl = parseLetterFromParam(params?.letter)
  const pageFromUrl = Math.max(1, parseInt(searchParams.get("pg") ?? "1", 10))

  const useInitialData =
    letterFromUrl &&
    initialLetter &&
    letterFromUrl.toUpperCase() === initialLetter.toUpperCase()

  const sortOptions = getDefaultSortOptions((key: string) =>
    tSort(key.replace("sortOptions.", ""))
  )

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfinitePerfumesByLetter({
    letter: letterFromUrl,
    houseType: "all",
    pageSize,
    initialData: useInitialData ? initialPerfumes : undefined,
    initialTotalCount: useInitialData ? initialPerfumeTotal : undefined,
  })

  const { items: perfumes, pagination, loading } = useInfinitePagination({
    pages: data?.pages,
    currentPage: pageFromUrl,
    pageSize,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    extractItems: (page: { perfumes?: unknown[] }) =>
      page.perfumes ?? [],
    extractTotalCount: (page?: { meta?: { totalCount?: number }; count?: number }) =>
      page?.meta?.totalCount ?? page?.count,
  })

  const normalizedPerfumes = (perfumes as PerfumeFromApi[]).map((perfume) => ({
    ...perfume,
    createdAt: perfume.createdAt ?? perfume.updatedAt ?? new Date(0),
  }))

  const sortedPerfumes = sortItems(normalizedPerfumes, selectedSort)

  const buildPath = useMemo(
    () => (page: number) => {
      const letterSegment = letterFromUrl
        ? `/${letterFromUrl.toLowerCase()}`
        : ""
      const pageSuffix = page > 1 ? `?pg=${page}` : ""
      return `${ROUTE_PATH}${letterSegment}${pageSuffix}`
    },
    [letterFromUrl]
  )

  const navigate = useMemo(
    () =>
      (
        to: string,
        opts?: { replace?: boolean; preventScrollReset?: boolean }
      ) => {
        router[opts?.replace ? "replace" : "push"](to, {
          scroll: !opts?.preventScrollReset,
        })
      },
    [router]
  )

  const { handleNextPage, handlePrevPage } = usePaginatedNavigation({
    currentPage: pagination.currentPage,
    hasNextPage: pagination.hasNextPage,
    hasPrevPage: pagination.hasPrevPage,
    navigate,
    buildPath,
  })

  usePreserveScrollPosition(loading)

  useSyncPaginationUrl({
    currentPage: pagination.currentPage,
    pageFromUrl,
    letter: letterFromUrl,
    basePath: letterFromUrl
      ? `${ROUTE_PATH}/${letterFromUrl.toLowerCase()}`
      : ROUTE_PATH,
  })

  const handleLetterClick = (letter: string | null) => {
    if (letter) {
      router.push(`${ROUTE_PATH}/${letter.toLowerCase()}`, { scroll: false })
    } else {
      router.push(ROUTE_PATH, { scroll: false })
    }
  }

  useScrollToDataList({
    trigger: letterFromUrl,
    enabled: !!letterFromUrl,
    isLoading: loading,
    hasData: perfumes.length > 0,
    additionalOffset: 32,
  })

  useScrollToDataList({
    trigger: pagination.currentPage,
    enabled: !!letterFromUrl && !!pagination.currentPage,
    isLoading: loading,
    hasData: perfumes.length > 0,
    additionalOffset: 32,
    skipInitialScroll: true,
  })

  if (error) {
    return (
      <div>
        Error loading perfumes:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    )
  }

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />

      <DataFilters
        searchType="perfume"
        sortOptions={sortOptions}
        selectedSort={selectedSort}
        onSortChange={(evt: { target: { value: string } }) =>
          setSelectedSort(evt.target.value as SortOption)
        }
        className="mb-8"
      />

      <AlphabeticalNav
        selectedLetter={letterFromUrl}
        onLetterSelect={handleLetterClick}
        prefetchType="perfumes"
        houseType="all"
        className="mb-8"
      />

      <DataDisplaySection
        data={sortedPerfumes}
        isLoading={loading}
        type="perfume"
        selectedLetter={letterFromUrl}
        sourcePage="vault"
        pagination={pagination}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
      />
    </section>
  )
}

export default TheVaultClient
