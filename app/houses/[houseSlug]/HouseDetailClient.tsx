"use client"

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import Select from "@/components/Atoms/Select/Select"
import {
  PerfumeHouseHero,
  PerfumeHousePerfumeList,
  PerfumeHouseSummaryCard,
} from "@/components/Containers/PerfumeHouse"

const PerfumeHouseAdminActions = dynamic(
  () =>
    import("@/components/Containers/PerfumeHouse").then((mod) => ({
      default: mod.PerfumeHouseAdminActions,
    })),
  { ssr: false }
)
import { RelatedArticlesSection } from "@/components/Containers/Blog/RelatedArticlesSection"
import FollowButton from "@/components/Containers/Follow/FollowButton"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import DangerModal from "@/components/Organisms/DangerModal"
import Modal from "@/components/Organisms/Modal"
import { useHouse } from "@/hooks/useHouse"
import { useInfinitePagination } from "@/hooks/useInfinitePagination"
import { useInfinitePerfumesByHouse } from "@/hooks/useInfinitePerfumes"
import { useResponsivePageSize } from "@/hooks/useMediaQuery"
import {
  usePaginatedNavigation,
  usePreserveScrollPosition,
} from "@/hooks/usePaginatedNavigation"
import { useScrollToDataList } from "@/hooks/useScrollToDataList"
import { useDeleteHouse } from "@/lib/mutations/houses"
import { useSessionStore } from "@/hooks/sessionStore"
import {
  DEFAULT_HOUSE_DETAIL_SORT,
  normalizeHousePerfumeNameSearch,
  parseHouseDetailSortOption,
} from "@/utils/house-perfumes-url-params"
import type { ArticleListItem } from "@/lib/sanity/types"
import { getDefaultSortOptions, type SortOption } from "@/utils/sortUtils"

const HOUSES_BASE_PATH = "/houses"
const HOUSE_SEARCH_DEBOUNCE_MS = 400

const getInitialPerfumeData = (house: {
  perfumes?: unknown[]
  perfumeCount?: number
  _count?: { perfumes?: number }
}) => {
  const perfumes = (house.perfumes || []) as unknown[]
  const count =
    typeof house?.perfumeCount === "number"
      ? house.perfumeCount
      : house?._count?.perfumes ?? perfumes.length ?? 0

  return { perfumes, count }
}

const buildHouseDetailPath = (
  slug: string,
  opts: {
    page?: number
    letter?: string | null
    q?: string
    sort?: SortOption
  } = {}
) => {
  const params = new URLSearchParams()
  if (opts.letter) params.set("letter", opts.letter)
  if (opts.page && opts.page > 1) params.set("pg", String(opts.page))
  if (opts.q) params.set("q", opts.q)
  if (opts.sort && opts.sort !== DEFAULT_HOUSE_DETAIL_SORT) params.set("sort", opts.sort)
  const query = params.toString()
  return query ? `${HOUSES_BASE_PATH}/${slug}?${query}` : `${HOUSES_BASE_PATH}/${slug}`
}

interface HouseDetailClientProps {
  initialPerfumeHouse: Awaited<
    ReturnType<typeof import("@/models/house.server").getPerfumeHouseBySlug>
  >
  relatedArticles: ArticleListItem[]
  user?: { id?: string; role?: string } | null
  initialFollowing?: boolean
  initialSearchParams: { pg: string; letter?: string; q?: string; sort?: string }
}

const HouseDetailClient = ({
  initialPerfumeHouse,
  relatedArticles,
  user,
  initialFollowing = false,
  initialSearchParams,
}: HouseDetailClientProps) => {
  const t = useTranslations("singleHouse")
  const tSort = useTranslations("sortOptions")
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: perfumeHouse } = useHouse(
    initialPerfumeHouse?.slug ?? "",
    initialPerfumeHouse ?? undefined
  )

  const { modalOpen, toggleModal, modalId, closeModal } = useSessionStore()
  const pageSize = useResponsivePageSize()

  const navigate: Parameters<typeof usePaginatedNavigation>[0]["navigate"] = (
    to,
    opts
  ) => {
    const scroll = opts?.preventScrollReset === false
    if (opts?.replace) {
      router.replace(to, { scroll })
    } else {
      router.push(to, { scroll })
    }
  }

  const selectedLetter =
    searchParams.get("letter") ?? initialSearchParams.letter ?? null
  const pageFromUrl = parseInt(
    searchParams.get("pg") ?? initialSearchParams.pg ?? "1",
    10
  )

  const sortParam = searchParams.get("sort")
  const qParam = searchParams.get("q")

  const sortOption = useMemo(
    () => parseHouseDetailSortOption(sortParam),
    [sortParam]
  )

  const qNormalized = useMemo(
    () => normalizeHousePerfumeNameSearch(qParam) ?? "",
    [qParam]
  )

  const urlQRaw = searchParams.get("q") ?? ""
  const [qDraft, setQDraft] = useState(urlQRaw)

  useEffect(() => {
    setQDraft(urlQRaw)
  }, [urlQRaw])

  const qDraftNormalized = useMemo(
    () => normalizeHousePerfumeNameSearch(qDraft) ?? "",
    [qDraft]
  )

  const currentPage =
    Number.isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl

  const initialPerfumeData = initialPerfumeHouse
    ? getInitialPerfumeData(initialPerfumeHouse)
    : { perfumes: [] as unknown[], count: 0 }

  const initialSortCanon = parseHouseDetailSortOption(initialSearchParams.sort)
  const initialQNormalized =
    normalizeHousePerfumeNameSearch(initialSearchParams.q) ?? ""

  const ssrMatchesListUrl =
    initialSortCanon === sortOption && initialQNormalized === qNormalized

  const sortByForApi =
    sortOption === DEFAULT_HOUSE_DETAIL_SORT ? "" : sortOption

  const houseSlug = (perfumeHouse ?? initialPerfumeHouse)?.slug ?? ""

  useEffect(() => {
    if (!houseSlug) return
    if (qDraftNormalized === qNormalized) return
    const id = window.setTimeout(() => {
      router.replace(
        buildHouseDetailPath(houseSlug, {
          page: 1,
          letter: selectedLetter,
          q: qDraftNormalized,
          sort: sortOption,
        }),
        { scroll: false }
      )
    }, HOUSE_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [
    houseSlug,
    qDraftNormalized,
    qNormalized,
    router,
    selectedLetter,
    sortOption,
  ])

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfinitePerfumesByHouse({
    houseSlug,
    pageSize,
    initialData: ssrMatchesListUrl
      ? (initialPerfumeData.perfumes as any[])
      : undefined,
    initialTotalCount: ssrMatchesListUrl
      ? initialPerfumeData.count
      : undefined,
    sortBy: sortByForApi,
    q: qNormalized,
  })

  const {
    items: perfumes,
    pagination,
    loading,
  } = useInfinitePagination({
    pages: data?.pages,
    currentPage,
    pageSize,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    extractItems: (page: any) => page?.perfumes ?? [],
    extractTotalCount: (page: any) =>
      page?.meta?.totalCount ?? page?._count?.perfumes ?? page?.count,
  })

  const { goToPage } = usePaginatedNavigation({
    currentPage: pagination.currentPage,
    hasNextPage: pagination.hasNextPage,
    hasPrevPage: pagination.hasPrevPage,
    navigate,
    buildPath: (page) =>
      buildHouseDetailPath(houseSlug, {
        page,
        letter: selectedLetter,
        q: qNormalized,
        sort: sortOption,
      }),
    totalPages: pagination.totalPages,
  })

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

  useEffect(() => {
    if (pagination.totalPages > 0 && currentPage > pagination.totalPages) {
      router.replace(
        buildHouseDetailPath(houseSlug, {
          page: pagination.totalPages,
          letter: selectedLetter,
          q: qNormalized,
          sort: sortOption,
        }),
        { scroll: false }
      )
    }

    if (pagination.totalCount === 0 && currentPage !== 1) {
      router.replace(
        buildHouseDetailPath(houseSlug, {
          letter: selectedLetter,
          q: qNormalized,
          sort: sortOption,
        }),
        { scroll: false }
      )
    }
  }, [
    currentPage,
    houseSlug,
    router,
    pagination.totalCount,
    pagination.totalPages,
    selectedLetter,
    qNormalized,
    sortOption,
  ])

  usePreserveScrollPosition(loading)

  useScrollToDataList({
    trigger: pagination.currentPage,
    enabled: pagination.totalCount > 0,
    isLoading: loading,
    hasData: perfumes.length > 0,
    additionalOffset: 32,
    skipInitialScroll: true,
  })

  const deleteHouse = useDeleteHouse()

  const handleDelete = () => {
    const house = perfumeHouse ?? initialPerfumeHouse
    deleteHouse.mutate(
      { houseId: house.id },
      {
        onSuccess: () => {
          closeModal()
          router.push(HOUSES_BASE_PATH)
        },
        onError: (err) => {
          console.error("Failed to delete house:", err)
          alert("Failed to delete house. Please try again.")
        },
      }
    )
  }

  const handleDeleteClick = () => {
    const buttonRef = { current: document.createElement("button") }
    toggleModal(buttonRef as React.RefObject<HTMLButtonElement>, "delete-perfume-house-item")
  }

  const handleSortChange = (evt: ChangeEvent<HTMLSelectElement>) => {
    const next = evt.target.value as SortOption
    router.replace(
      buildHouseDetailPath(houseSlug, {
        page: 1,
        letter: selectedLetter,
        q: qNormalized,
        sort: next,
      }),
      { scroll: false }
    )
  }

  const sortOptions = useMemo(
    () =>
      getDefaultSortOptions((key: string) =>
        tSort(key.replace("sortOptions.", ""))
      ).filter((o) => o.id !== "type-asc"),
    [tSort]
  )

  const backPath =
    selectedLetter
      ? `${HOUSES_BASE_PATH}?letter=${selectedLetter}`
      : HOUSES_BASE_PATH

  if (!perfumeHouse && !initialPerfumeHouse) {
    return <div className="p-4">{t("notFound")}</div>
  }

  const house = perfumeHouse ?? initialPerfumeHouse
  const totalPerfumeCount =
    pagination.totalCount || initialPerfumeData.count || 0
  const listError =
    error instanceof Error ? error : error ? new Error(String(error)) : null

  return (
    <>
      {modalOpen && modalId === "delete-perfume-house-item" && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading={t("deleteModal.heading")}
            description={t("deleteModal.description")}
            action={handleDelete}
          />
        </Modal>
      )}
      <section className="relative z-10 my-4">
        <PerfumeHouseHero
          name={house.name}
          image={house.image}
          transitionKey={house.id}
          type="house"
        />

        <div className="inner-container mt-4 flex justify-center">
          <FollowButton
            targetType="house"
            targetId={house.id}
            initialFollowing={initialFollowing}
            viewerId={user?.id ?? null}
          />
        </div>

        <div className="flex flex-col gap-10 mx-auto max-w-6xl inner-container">
          {user?.role === "admin" && (
            <PerfumeHouseAdminActions
              houseName={house.name}
              houseSlug={house.slug}
              onDeleteClick={handleDeleteClick}
            />
          )}

          <PerfumeHouseSummaryCard
            perfumeHouse={house}
            totalPerfumeCount={totalPerfumeCount}
            selectedLetter={selectedLetter}
            backPath={backPath}
          />

          <div className="noir-border rounded-t-lg w-full p-4 flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
            <div className="w-full md:flex-1 md:max-w-md">
              <SearchInput
                value={qDraft}
                onChange={setQDraft}
                placeholder={t("searchPerfumesPlaceholder")}
              />
            </div>
            <Select
              selectId="house-perfumes-sort"
              selectData={sortOptions}
              action={handleSortChange}
              defaultId={sortOption}
              label={t("sortPerfumes")}
              size="compact"
            />
          </div>

          <PerfumeHousePerfumeList
            perfumes={perfumes}
            loading={loading}
            pagination={pagination}
            onPageChange={goToPage}
            selectedLetter={selectedLetter}
            queryError={listError ?? undefined}
            onPrefetchNext={onPrefetchNext}
            onPrefetchPage={onPrefetchPage}
          />

          <RelatedArticlesSection articles={relatedArticles} />
        </div>
      </section>
    </>
  )
}

export default HouseDetailClient
