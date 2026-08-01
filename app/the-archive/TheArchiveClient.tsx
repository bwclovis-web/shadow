"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import AlphabeticalNav from "@/components/Organisms/AlphabeticalNav"
import DataDisplaySection from "@/components/Organisms/DataDisplaySection"
import DataFilters from "@/components/Organisms/DataFilters"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { THE_ARCHIVE_PATH } from "@/constants/routes"
import { useAlphabeticalBrowserState } from "@/hooks/useAlphabeticalBrowserState"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { useInfinitePagination } from "@/hooks/useInfinitePagination"
import { useInfinitePerfumesByLetter } from "@/hooks/useInfinitePerfumes"
import { useResponsivePageSize } from "@/hooks/useMediaQuery"
import {
  getDefaultSortOptions,
  sortItems,
  type SortOption,
} from "@/utils/sortUtils"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/new/vault.webp"
const SINGLE_LETTER_REGEX = /^[A-Za-z]$/
type ArchiveRevealDirection = "forward" | "backward"
const ARCHIVE_STAGGER = 0.042
const ARCHIVE_HORIZONTAL_OFFSET = 16
const ARCHIVE_VERTICAL_OFFSET = 12

export type TheArchiveClientProps = {
  initialLetter?: string | null
  initialPerfumes?: PerfumeFromApi[]
  initialPerfumeTotal?: number
  /** When set (from `?q=`), show name-search results instead of letter browse. */
  initialSearchQuery?: string | null
  initialSearchResults?: PerfumeFromApi[]
}

type PerfumeFromApi = {
  id: string
  name: string
  slug: string
  createdAt?: Date | string
  updatedAt?: Date | string
  type?: string
  image?: string
  perfumeHouse?: { name: string } | null
}

const parseLetterFromParam = (param: unknown): string | null => {
  if (typeof param !== "string" || !SINGLE_LETTER_REGEX.test(param)) return null
  return param.toUpperCase()
}

const getLetterRank = (letter: string | null): number =>
  letter ? letter.charCodeAt(0) - 64 : 0

const getArchiveNavigationRank = (letter: string | null, page: number): number =>
  getLetterRank(letter) * 1_000 + page

const TheArchiveClient = ({
  initialLetter = null,
  initialPerfumes = [],
  initialPerfumeTotal = 0,
  initialSearchQuery = null,
  initialSearchResults = [],
}: TheArchiveClientProps = {}) => {
  const t = useTranslations("allPerfumes")
  const tSort = useTranslations("sortOptions")
  const params = useParams()
  const searchParams = useSearchParams()

  const [selectedSort, setSelectedSort] = useState<SortOption>("created-desc")
  const [archiveRevealDirection, setArchiveRevealDirection] =
    useState<ArchiveRevealDirection>("forward")
  const [gridCueToken, setGridCueToken] = useState(0)
  const archiveGridRef = useRef<HTMLDivElement>(null)
  const previousArchiveSelectionRef = useRef<{
    letter: string | null
    page: number
  } | null>(null)

  const pageSize = useResponsivePageSize()
  const letterFromUrl = parseLetterFromParam(params?.letter)
  const pageFromUrl = Math.max(1, parseInt(searchParams.get("pg") ?? "1", 10))
  const searchQueryFromUrl = (searchParams.get("q") ?? "").trim()
  const activeSearchQuery = searchQueryFromUrl || initialSearchQuery || null
  const isSearchMode = Boolean(activeSearchQuery)

  const useInitialData =
    !isSearchMode &&
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
    letter: isSearchMode ? null : letterFromUrl,
    houseType: "all",
    pageSize,
    initialData: useInitialData ? initialPerfumes : undefined,
    initialTotalCount: useInitialData ? initialPerfumeTotal : undefined,
  })

  const { items: letterPerfumes, pagination, loading: letterLoading } =
    useInfinitePagination({
      pages: data?.pages,
      currentPage: pageFromUrl,
      pageSize,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      extractItems: (page: { perfumes?: unknown[] }) => page.perfumes ?? [],
      extractTotalCount: (page?: {
        meta?: { totalCount?: number }
        count?: number
      }) => page?.meta?.totalCount ?? page?.count,
    })

  const searchPerfumes: PerfumeFromApi[] = isSearchMode
    ? initialSearchResults
    : []

  const perfumes = isSearchMode
    ? searchPerfumes
    : (letterPerfumes as PerfumeFromApi[])
  const loading = isSearchMode ? false : letterLoading
  const searchPagination = {
    currentPage: 1,
    totalPages: 1,
    totalCount: searchPerfumes.length,
    hasNextPage: false,
    hasPrevPage: false,
  }
  const paginationForUi = isSearchMode ? searchPagination : pagination
  const normalizedPerfumes = (perfumes as PerfumeFromApi[]).map((perfume) => ({
    ...perfume,
    createdAt: perfume.createdAt ?? perfume.updatedAt ?? new Date(0),
  }))

  const sortedPerfumes = sortItems(normalizedPerfumes, selectedSort)
  const sortedPerfumeIds = sortedPerfumes
    .map(perfume => perfume.id)
    .join(",")

  useEffect(() => {
    const nextSelection = { letter: letterFromUrl, page: pageFromUrl }
    const previousSelection = previousArchiveSelectionRef.current

    if (previousSelection) {
      const previousRank = getArchiveNavigationRank(
        previousSelection.letter,
        previousSelection.page
      )
      const nextRank = getArchiveNavigationRank(
        nextSelection.letter,
        nextSelection.page
      )

      if (previousRank !== nextRank) {
        setArchiveRevealDirection(nextRank > previousRank ? "forward" : "backward")
      }

      if (previousSelection.letter !== nextSelection.letter) {
        setGridCueToken(current => current + 1)
      }
    }

    previousArchiveSelectionRef.current = nextSelection
  }, [letterFromUrl, pageFromUrl])

  useGsapStagger(archiveGridRef, {
    selector: "[data-display-card]",
    deps: [
      letterFromUrl ?? "all",
      pageFromUrl,
      selectedSort,
      sortedPerfumeIds,
      archiveRevealDirection,
    ],
    enabled: !loading && sortedPerfumes.length > 0,
    stagger: ARCHIVE_STAGGER,
    from: {
      opacity: 0,
      x:
        archiveRevealDirection === "forward"
          ? ARCHIVE_HORIZONTAL_OFFSET
          : -ARCHIVE_HORIZONTAL_OFFSET,
      y: ARCHIVE_VERTICAL_OFFSET,
      scale: 0.982,
    },
    to: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.42,
      ease: "power2.out",
      clearProps: "transform,opacity",
    },
  })

  const buildPath = (page: number) => {
    const letterSegment = letterFromUrl
      ? `/${letterFromUrl.toLowerCase()}`
      : ""
    const pageSuffix = page > 1 ? `?pg=${page}` : ""
    return `${THE_ARCHIVE_PATH}${letterSegment}${pageSuffix}`
  }

  const buildPathForLetter = (letter: string | null) =>
    letter ? `${THE_ARCHIVE_PATH}/${letter.toLowerCase()}` : THE_ARCHIVE_PATH

  const { handleLetterClick, goToPage } = useAlphabeticalBrowserState({
      letter: letterFromUrl,
      pageFromUrl,
      basePathForSync: letterFromUrl
        ? `${THE_ARCHIVE_PATH}/${letterFromUrl.toLowerCase()}`
        : THE_ARCHIVE_PATH,
      buildPath,
      buildPathForLetter,
      pagination: paginationForUi,
      loading,
      itemCount: perfumes.length,
    })

  const onPrefetchNext = useCallback(() => {
    if (isSearchMode || !hasNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isSearchMode])

  const onPrefetchPage = useCallback(
    (targetPage: number) => {
      if (isSearchMode) return
      if (targetPage <= pagination.currentPage) return
      if (!hasNextPage) return
      void fetchNextPage()
    },
    [fetchNextPage, hasNextPage, isSearchMode, pagination.currentPage]
  )

  if (error && !isSearchMode) {
    return (
      <div>
        Error loading perfumes:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    )
  }

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={
          isSearchMode && activeSearchQuery
            ? t("searchHeading", { query: activeSearchQuery })
            : t("heading")
        }
        subheading={
          isSearchMode && activeSearchQuery
            ? t("searchSubheading", {
                count: sortedPerfumes.length,
                query: activeSearchQuery,
              })
            : t("subheading")
        }
      />

      <PageWrapper>
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
          selectedLetter={isSearchMode ? null : letterFromUrl}
          onLetterSelect={handleLetterClick}
          prefetchType="perfumes"
          houseType="all"
          pageSize={pageSize}
          className="mb-8"
        />

        {isSearchMode && sortedPerfumes.length === 0 ? (
          <p className="text-noir-light text-lg">{t("searchEmpty")}</p>
        ) : (
          <DataDisplaySection
            containerRef={archiveGridRef}
            data={sortedPerfumes}
            isLoading={loading}
            type="perfume"
            selectedLetter={isSearchMode ? null : letterFromUrl}
            sourcePage="archive"
            transitionCueKey={
              gridCueToken > 0
                ? `archive-${gridCueToken}-${letterFromUrl ?? "all"}`
                : undefined
            }
            transitionCueDirection={archiveRevealDirection}
            transitionCueTone="archive"
            pagination={isSearchMode ? undefined : pagination}
            onPageChange={isSearchMode ? undefined : goToPage}
            onPrefetchNext={isSearchMode ? undefined : onPrefetchNext}
            onPrefetchPage={isSearchMode ? undefined : onPrefetchPage}
          />
        )}
      </PageWrapper>
    </main>
  )
}

export default TheArchiveClient
