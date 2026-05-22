"use client"

import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { BEHIND_THE_BOTTLE_PATH } from "@/constants/routes"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import AlphabeticalNav from "@/components/Organisms/AlphabeticalNav"
import DataDisplaySection from "@/components/Organisms/DataDisplaySection"
import DataFilters from "@/components/Organisms/DataFilters"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { useAlphabeticalBrowserState } from "@/hooks/useAlphabeticalBrowserState"
import { useInfiniteHouses } from "@/hooks/useInfiniteHouses"
import { useInfinitePagination } from "@/hooks/useInfinitePagination"
import { useResponsivePageSize } from "@/hooks/useMediaQuery"
import {
  getDefaultSortOptions,
  sortItems,
  type SortOption,
} from "@/utils/sortUtils"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const ROUTE_PATH = "/houses"

const BANNER_IMAGE = "/images/behind-bottle.webp"

interface AllHousesClientProps {
  heading: string
  subheading: string
  showBlogLink?: boolean
  initialLetter?: string | null
  initialHouses?: unknown[]
  initialHousesTotal?: number
}

const useHouseFilters = (t: ReturnType<typeof useTranslations<"allHouses">>) => {
  const houseTypeOptions = [
    {
      id: "all",
      value: "all",
      label: t("houseTypes.all"),
      name: "houseType",
      defaultChecked: true,
    },
    {
      id: "niche",
      value: "niche",
      label: t("houseTypes.niche"),
      name: "houseType",
      defaultChecked: false,
    },
    {
      id: "designer",
      value: "designer",
      label: t("houseTypes.designer"),
      name: "houseType",
      defaultChecked: false,
    },
    {
      id: "indie",
      value: "indie",
      label: t("houseTypes.indie"),
      name: "houseType",
      defaultChecked: false,
    },
    {
      id: "celebrity",
      value: "celebrity",
      label: t("houseTypes.celebrity"),
      name: "houseType",
      defaultChecked: false,
    },
    {
      id: "drugstore",
      value: "drugstore",
      label: t("houseTypes.drugstore"),
      name: "houseType",
      defaultChecked: false,
    },
  ]

  const sortOptions = getDefaultSortOptions(t)

  return { houseTypeOptions, sortOptions }
}

const useHouseHandlers = (
  setSelectedHouseType: (houseType: string) => void,
  setSelectedSort: (sort: SortOption) => void
) => {
  const handleHouseTypeChange = (evt: { target: { value: string } }) => {
    setSelectedHouseType(evt.target.value)
  }

  const handleSortChange = (evt: { target: { value: string } }) => {
    setSelectedSort(evt.target.value as SortOption)
  }

  return { handleHouseTypeChange, handleSortChange }
}

const useHousesData = (
  letterFromUrl: string | null,
  selectedHouseType: string,
  currentPage: number,
  pageSize: number,
  initialData?: unknown[],
  initialTotalCount?: number
) => {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteHouses({
    letter: letterFromUrl,
    houseType: selectedHouseType,
    pageSize,
    initialData,
    initialTotalCount,
  })

  const { items: houses, pagination, loading } = useInfinitePagination({
    pages: data?.pages,
    currentPage,
    pageSize,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    extractItems: (page) => (page as { houses?: unknown[] }).houses ?? [],
    extractTotalCount: (page) =>
      (page as { meta?: { totalCount?: number }; count?: number })?.meta
        ?.totalCount ??
      (page as { count?: number })?.count,
  })

  return {
    houses,
    pagination,
    loading,
    error,
    data,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
  }
}

const buildHousesPath = (
  letter: string | null,
  page: number
): string => {
  const params = new URLSearchParams()
  if (letter) params.set("letter", letter.toLowerCase())
  if (page > 1) params.set("pg", page.toString())
  const query = params.toString()
  return query ? `${ROUTE_PATH}?${query}` : ROUTE_PATH
}

const AllHousesClient = ({
  heading,
  subheading,
  showBlogLink = false,
  initialLetter = null,
  initialHouses = [],
  initialHousesTotal = 0,
}: AllHousesClientProps) => {
  const t = useTranslations("allHouses")
  const searchParams = useSearchParams()

  const [selectedHouseType, setSelectedHouseType] = useState("all")
  const [selectedSort, setSelectedSort] = useState<SortOption>("created-desc")

  const pageSize = useResponsivePageSize()

  const letterParam = searchParams.get("letter")
  const letterFromUrl =
    letterParam && /^[A-Za-z]$/.test(letterParam)
      ? letterParam.toUpperCase()
      : null

  const pageFromUrl = Math.max(1, parseInt(searchParams.get("pg") ?? "1", 10))

  const useInitialData =
    letterFromUrl &&
    initialLetter &&
    letterFromUrl === initialLetter &&
    selectedHouseType === "all"

  const filters = useHouseFilters(t)
  const handlers = useHouseHandlers(setSelectedHouseType, setSelectedSort)

  const {
    houses,
    pagination,
    loading,
    error,
    fetchNextPage,
    hasNextPage,
  } = useHousesData(
    letterFromUrl,
    selectedHouseType,
    pageFromUrl,
    pageSize,
    useInitialData ? initialHouses : undefined,
    useInitialData ? initialHousesTotal : undefined
  )

  const onPrefetchNext = useCallback(() => {
    if (!hasNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage])

  const onPrefetchPage = useCallback(
    (targetPage: number) => {
      if (targetPage <= pagination.currentPage) return
      if (!hasNextPage) return
      void fetchNextPage()
    },
    [fetchNextPage, hasNextPage, pagination.currentPage]
  )

  const normalizedHouses = useMemo(
    () =>
      houses.map((house) => {
        const h = house as Record<string, unknown> & {
          id?: string
          name?: string
          slug?: string
          createdAt?: Date
          updatedAt?: Date
        }
        return {
          ...h,
          id: h.id ?? "",
          name: h.name ?? "",
          slug: h.slug ?? "",
          createdAt:
            h.createdAt ?? h.updatedAt ?? new Date(0),
        }
      }),
    [houses]
  )

  const sortedHouses = useMemo(
    () => sortItems(normalizedHouses as import("@/utils/sortUtils").SortableItem[], selectedSort),
    [normalizedHouses, selectedSort]
  )

  const buildPath = useMemo(
    () => (page: number) => buildHousesPath(letterFromUrl, page),
    [letterFromUrl]
  )

  const buildPathForLetter = useMemo(
    () => (letter: string | null) => buildHousesPath(letter, 1),
    []
  )

  const { handleLetterClick, goToPage } = useAlphabeticalBrowserState({
      letter: letterFromUrl,
      pageFromUrl,
      basePathForSync: ROUTE_PATH,
      buildPath,
      buildPathForLetter,
      pagination,
      loading,
      itemCount: houses.length,
    })

  if (error) {
    return (
      <div>
        Error loading houses:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </div>
    )
  }

  return (  
    <main id="main-content">
      
      <TitleBanner
        image={BANNER_IMAGE}
        heading={heading}
        subheading={subheading}
      />
    <PageWrapper>
      {/* {showBlogLink ? (
        <p className="inner-container -mt-6 mb-8 text-center">
          <PrefetchLink
            href={BEHIND_THE_BOTTLE_PATH}
            className="text-blue-200 underline hover:text-noir-gold font-medium"
          >
            {t("readStories")}
          </PrefetchLink>
        </p>
      ) : null} */}

      <DataFilters
        searchType="perfume-house"
        sortOptions={filters.sortOptions}
        typeOptions={filters.houseTypeOptions}
        selectedSort={selectedSort}
        selectedType={selectedHouseType}
        onSortChange={handlers.handleSortChange}
        onTypeChange={handlers.handleHouseTypeChange}
        className="mb-8"
      />

      <AlphabeticalNav
        selectedLetter={letterFromUrl}
        onLetterSelect={handleLetterClick}
        prefetchType="houses"
        houseType={selectedHouseType}
        pageSize={pageSize}
        className="mb-8"
      />

      <DataDisplaySection
        data={sortedHouses as unknown as { id: string; name: string; slug: string; image?: string; type?: string; perfumeHouse?: { name: string } }[]}
        isLoading={loading}
        type="house"
        selectedLetter={letterFromUrl}
        sourcePage="houses"
        pagination={pagination}
        onPageChange={goToPage}
        onPrefetchNext={onPrefetchNext}
        onPrefetchPage={onPrefetchPage}
      />
      </PageWrapper>
    </main>
  )
}

export default AllHousesClient
