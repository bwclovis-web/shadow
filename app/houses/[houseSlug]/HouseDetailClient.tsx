"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

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

const HOUSES_BASE_PATH = "/houses"

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
  page?: number,
  letter?: string | null
): string => {
  const params = new URLSearchParams()
  if (letter) params.set("letter", letter)
  if (page && page > 1) params.set("pg", page.toString())
  const query = params.toString()
  return query ? `${HOUSES_BASE_PATH}/${slug}?${query}` : `${HOUSES_BASE_PATH}/${slug}`
}

interface HouseDetailClientProps {
  initialPerfumeHouse: Awaited<
    ReturnType<typeof import("@/models/house.server").getPerfumeHouseBySlug>
  >
  user?: { id?: string; role?: string } | null
  initialSearchParams: { pg: string; letter?: string }
}

export default function HouseDetailClient({
  initialPerfumeHouse,
  user,
  initialSearchParams,
}: HouseDetailClientProps) {
  const t = useTranslations("singleHouse")
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

  const currentPage =
    Number.isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl

  const initialPerfumeData = initialPerfumeHouse
    ? getInitialPerfumeData(initialPerfumeHouse)
    : { perfumes: [] as unknown[], count: 0 }

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfinitePerfumesByHouse({
    houseSlug: perfumeHouse?.slug ?? initialPerfumeHouse?.slug ?? "",
    pageSize,
    initialData: initialPerfumeData.perfumes as any[],
    initialTotalCount: initialPerfumeData.count,
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

  const houseSlug = (perfumeHouse ?? initialPerfumeHouse)?.slug ?? ""

  const { handleNextPage, handlePrevPage } = usePaginatedNavigation({
    currentPage: pagination.currentPage,
    hasNextPage: pagination.hasNextPage,
    hasPrevPage: pagination.hasPrevPage,
    navigate,
    buildPath: (page) => buildHouseDetailPath(houseSlug, page, selectedLetter),
  })

  useEffect(() => {
    if (pagination.totalPages > 0 && currentPage > pagination.totalPages) {
      router.replace(
        buildHouseDetailPath(houseSlug, pagination.totalPages, selectedLetter),
        { scroll: false }
      )
    }

    if (pagination.totalCount === 0 && currentPage !== 1) {
      router.replace(buildHouseDetailPath(houseSlug, undefined, selectedLetter), {
        scroll: false,
      })
    }
  }, [
    currentPage,
    houseSlug,
    router,
    pagination.totalCount,
    pagination.totalPages,
    selectedLetter,
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

        <div className="flex flex-col gap-10 lg:gap-20 mx-auto max-w-6xl inner-container">
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

          <PerfumeHousePerfumeList
            perfumes={perfumes}
            loading={loading}
            pagination={pagination}
            onNextPage={handleNextPage}
            onPrevPage={handlePrevPage}
            selectedLetter={selectedLetter}
            queryError={listError ?? undefined}
          />
        </div>
      </section>
    </>
  )
}
