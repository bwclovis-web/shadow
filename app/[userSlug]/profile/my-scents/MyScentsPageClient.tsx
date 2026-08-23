"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { useSessionStore } from "@/hooks/sessionStore"

import { Button } from "@/components/Atoms/Button"
import BulkInventoryGrid from "@/components/Containers/MyScents/BulkInventoryGrid/BulkInventoryGrid"
import CsvImportPanel from "@/components/Containers/MyScents/CsvImport/CsvImportPanel"
import CollectionTab from "@/components/Containers/MyScents/CollectionTab"
import ListingsTab from "@/components/Containers/MyScents/ListingsTab"
import AddToCollectionModal from "@/components/Organisms/AddToCollectionModal"
import type { OptimisticCollectionItem } from "@/hooks/useMyScentsForm"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { useResponsivePageSize } from "@/hooks/useMediaQuery"
import { useDataWithFilters } from "@/hooks/useDataWithFilters"
import WishlistDemandSection from "@/components/Containers/MyScents/WishlistDemandSection"
import { SamplingQueuePanel } from "@/components/Containers/MyScents/SamplingQueuePanel"
import {
  getActiveListings,
  getBottleEntries,
  getPausedListings,
  parseMl,
} from "@/lib/user-inventory"
import { computeCollectionCounts } from "@/lib/user-inventory-stats"
import type { UserInventoryStats } from "@/models/user-inventory-stats.server"
import type { TraderWantingUserListingEnriched } from "@/services/trade-match"
import type { MyScentsView, UserPerfumeForClient } from "@/types/my-scents-client"
import type { SortOption } from "@/utils/sortUtils"
import MyScentsViewTabs from "@/components/Containers/MyScents/MyScentsViewTabs"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const USER_PERFUMES_API = "/api/user-perfumes"

export type { UserPerfumeForClient }

const CUSTOM_FILTERS = {
  house: {
    predicate: (item: UserPerfumeForClient, value: string) =>
      !value || value === "all" || item.perfume.perfumeHouse?.id === value,
  },
  minAmt: {
    predicate: (item: UserPerfumeForClient, value: string) => {
      if (!value) return true
      return parseMl(item.amount) >= parseFloat(value)
    },
  },
  maxAmt: {
    predicate: (item: UserPerfumeForClient, value: string) => {
      if (!value) return true
      return parseMl(item.amount) <= parseFloat(value)
    },
  },
} as const

type MyScentsPageClientProps = {
  userPerfumes: UserPerfumeForClient[]
  wishlistDemand?: TraderWantingUserListingEnriched[]
  inventoryStats: UserInventoryStats
  bannerImage: string
}

const serializeUserPerfume = (up: Record<string, unknown>): UserPerfumeForClient => {
  const createdAt = up.createdAt
  const createdAtStr =
    typeof createdAt === "string"
      ? createdAt
      : createdAt instanceof Date
        ? createdAt.toISOString()
        : ""
  return {
    ...up,
    createdAt: createdAtStr,
    available: up.available ?? null,
    pausedAvailable:
      up.pausedAvailable != null && up.pausedAvailable !== ""
        ? String(up.pausedAvailable)
        : null,
    price: up.price ?? null,
    placeOfPurchase: up.placeOfPurchase ?? null,
    tradePrice: up.tradePrice ?? null,
    tradePreference: up.tradePreference ?? null,
    tradeOnly: up.tradeOnly ?? null,
    type: up.type ?? null,
  } as UserPerfumeForClient
}

const buildOptimisticUserPerfume = (
  optimisticItem: OptimisticCollectionItem
): UserPerfumeForClient => ({
  id: optimisticItem.tempId,
  userId: "optimistic-user",
  perfumeId: optimisticItem.perfumeId,
  amount: optimisticItem.amount,
  available: null,
  price: optimisticItem.price || null,
  placeOfPurchase: optimisticItem.placeOfPurchase || null,
  tradePrice: null,
  tradePreference: null,
  tradeOnly: null,
  type: optimisticItem.type || null,
  createdAt: new Date().toISOString(),
  perfume: {
    id: optimisticItem.perfume.id,
    name: optimisticItem.perfume.name,
    slug: optimisticItem.perfume.slug || "",
    image: optimisticItem.perfume.image || null,
    description: optimisticItem.perfume.description || null,
    perfumeHouse: optimisticItem.perfume.perfumeHouse
      ? {
          id: optimisticItem.perfume.perfumeHouse.id,
          name: optimisticItem.perfume.perfumeHouse.name,
          slug: optimisticItem.perfume.perfumeHouse.slug || "",
        }
      : null,
  },
  _count: { comments: 0 },
  images: [],
  condition: null,
  decantFormat: null,
  mlRemaining: null,
})

const SORT_OPTIONS: SortOption[] = ["name-asc", "name-desc", "created-desc", "created-asc"]

const MyScentsPageClient = ({
  userPerfumes: initialUserPerfumes,
  wishlistDemand = [],
  inventoryStats,
  bannerImage,
}: MyScentsPageClientProps) => {
  const params = useParams()
  const userSlug = params?.userSlug as string
  const [userPerfumes, setUserPerfumes] = useState<UserPerfumeForClient[]>(initialUserPerfumes)
  const [statsOverride, setStatsOverride] = useState<UserInventoryStats | null>(null)
  const stats = statsOverride ?? inventoryStats
  const t = useTranslations("myScents")
  const tSort = useTranslations("sortOptions")
  const tTabs = useTranslations("myScents.tabs")
  const tSampling = useTranslations("samplingQueue")

  const liveInventoryStats = useMemo((): UserInventoryStats => {
    const { bottleCount, houseCount } = computeCollectionCounts(userPerfumes)
    return {
      ...stats,
      bottleCount,
      houseCount,
    }
  }, [userPerfumes, stats])

  const refreshCollection = useCallback(async () => {
    const res = await fetch(USER_PERFUMES_API, { credentials: "include" })
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    if (!data?.success || !Array.isArray(data.userPerfumes)) return
    setUserPerfumes(data.userPerfumes.map(serializeUserPerfume))
    if (data.inventoryStats) {
      setStatsOverride(data.inventoryStats as UserInventoryStats)
    }
  }, [])

  const handleOptimisticAdd = useCallback((optimisticItem: OptimisticCollectionItem) => {
    setUserPerfumes((prev) => [buildOptimisticUserPerfume(optimisticItem), ...prev])
  }, [])

  const handleOptimisticRollback = useCallback((tempId: string) => {
    setUserPerfumes((prev) => prev.filter((item) => item.id !== tempId))
  }, [])

  const bottleEntries = useMemo(() => getBottleEntries(userPerfumes), [userPerfumes])
  const activeListings = useMemo(() => getActiveListings(userPerfumes), [userPerfumes])
  const pausedListings = useMemo(() => getPausedListings(userPerfumes), [userPerfumes])

  const bottleCountByPerfumeId = useMemo(() => {
    const m = new Map<string, number>()
    for (const up of bottleEntries) {
      m.set(up.perfumeId, (m.get(up.perfumeId) ?? 0) + 1)
    }
    return m
  }, [bottleEntries])

  const existingPerfumeIds = useMemo(
    () => new Set(userPerfumes.map(up => up.perfumeId)),
    [userPerfumes]
  )

  const {
    filteredData,
    selectedSort,
    setSelectedSort,
    searchQuery,
    setSearchQuery,
    customFilterValues,
    setCustomFilterValue,
    resetFilters,
  } = useDataWithFilters<UserPerfumeForClient>({
    items: bottleEntries,
    nameAccessor: (up) => up.perfume.name,
    dateAccessor: (up) => up.createdAt,
    defaultSort: "name-asc",
    syncToUrl: true,
    customFilters: CUSTOM_FILTERS,
  })

  const houseOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const up of bottleEntries) {
      const house = up.perfume.perfumeHouse
      if (house && !seen.has(house.id)) {
        seen.set(house.id, house.name)
      }
    }
    const sorted = [...seen.entries()].sort(([, a], [, b]) => a.localeCompare(b))
    return [
      { id: "all", name: "house", label: t("filters.allHouses") },
      ...sorted.map(([id, name]) => ({ id, name: "house", label: name })),
    ]
  }, [bottleEntries, t])

  const sortSelectData = useMemo(
    () =>
      SORT_OPTIONS.map((opt) => ({
        id: opt,
        name: "sortBy",
        label: tSort(opt),
      })),
    [tSort],
  )

  const hasActiveFilters =
    customFilterValues.house && customFilterValues.house !== "all" ||
    customFilterValues.minAmt ||
    customFilterValues.maxAmt

  const pageSize = useResponsivePageSize()
  const router = useRouter()
  const searchParams = useSearchParams()
  const openModal = useSessionStore(s => s.openModal)
  const basePath = userSlug ? `/${userSlug}/profile/my-scents` : "/profile/my-scents"
  const activeView: MyScentsView =
    searchParams.get("view") === "listings" ? "listings" : "inventory"

  const handleListingChange = useCallback((updated: UserPerfumeForClient) => {
    setUserPerfumes((prev) =>
      prev.map((up) => (up.id === updated.id ? { ...up, ...updated } : up))
    )
  }, [])

  const setActiveView = useCallback(
    (view: MyScentsView) => {
      const next = new URLSearchParams(searchParams.toString())
      if (view === "inventory") next.delete("view")
      else next.set("view", "listings")
      next.delete("pg")
      const qs = next.toString()
      router.replace(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false })
    },
    [basePath, router, searchParams]
  )

  const [autoFocusAddSearch, setAutoFocusAddSearch] = useState(false)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  const openBulkAdd = useCallback(() => {
    setCsvImportOpen(false)
    setBulkAddOpen(open => !open)
  }, [])

  const openCsvImport = useCallback(() => {
    setBulkAddOpen(false)
    setCsvImportOpen(open => !open)
  }, [])

  useEffect(() => {
    if (searchParams.get("onboarding") !== "add-bottle") return
    setAutoFocusAddSearch(true)
    openModal("add-scent", { action: "create" })
    const next = new URLSearchParams(searchParams.toString())
    next.delete("onboarding")
    const qs = next.toString()
    router.replace(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false })
  }, [openModal, router, searchParams, basePath])

  const totalCount = filteredData.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const rawPage = Math.max(1, parseInt(searchParams.get("pg") ?? "1", 10) || 1)
  const currentPage = totalPages > 0 ? Math.min(rawPage, totalPages) : 1

  const paginatedPerfumes = useMemo(
    () => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredData, currentPage, pageSize],
  )

  useEffect(() => {
    if (totalPages >= 1 && rawPage > totalPages) {
      const next = new URLSearchParams(searchParams.toString())
      next.set("pg", String(totalPages))
      router.replace(`${basePath}?${next.toString()}`, { scroll: false })
    }
  }, [totalPages, rawPage, basePath, router, searchParams])

  const handlePageChange = useCallback(
    (page: number) => {
      const next = new URLSearchParams(searchParams.toString())
      if (page <= 1) next.delete("pg")
      else next.set("pg", String(page))
      const qs = next.toString()
      router.push(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false })
    },
    [basePath, router, searchParams],
  )

  return (
    <main id="main-content">
      <TitleBanner
        imagePos="object-bottom"
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <div className="flex flex-wrap items-center gap-3 mx-auto max-w-max">
          <AddToCollectionModal
            onAddedToCollection={refreshCollection}
            onOptimisticAddToCollection={handleOptimisticAdd}
            onOptimisticAddRollback={handleOptimisticRollback}
            autoFocusSearch={autoFocusAddSearch}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={openBulkAdd}
            aria-expanded={bulkAddOpen}
          >
            {bulkAddOpen ? t("bulk.close") : t("bulk.open")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openCsvImport}
            aria-expanded={csvImportOpen}
          >
            {csvImportOpen ? t("csvImport.close") : t("csvImport.open")}
          </Button>
        </div>
      </TitleBanner>
      <PageWrapper>
      {bulkAddOpen && (
        <BulkInventoryGrid
          existingPerfumeIds={existingPerfumeIds}
          onClose={() => setBulkAddOpen(false)}
          onAllSaved={refreshCollection}
        />
      )}

      {csvImportOpen && (
        <CsvImportPanel
          onClose={() => setCsvImportOpen(false)}
          onImportComplete={refreshCollection}
        />
      )}
      <WishlistDemandSection demand={wishlistDemand} />
      <section className="mb-8 space-y-3">
        <h2 className="text-lg uppercase tracking-wide text-noir-gold">
          {tSampling("heading")}
        </h2>
        <SamplingQueuePanel />
      </section>
      <div>
        <MyScentsViewTabs
          activeView={activeView}
          onViewChange={setActiveView}
          ariaLabel={tTabs("ariaLabel")}
          inventoryLabel={tTabs("inventory")}
          listingsLabel={tTabs("listings")}
          listingsCount={activeListings.length + pausedListings.length}
          listingsPanel={
            activeView === "listings" ? (
              <ListingsTab
                activeListings={activeListings}
                pausedListings={pausedListings}
                basePath={basePath}
                onListingChange={handleListingChange}
              />
            ) : null
          }
          inventoryPanel={
            <CollectionTab
              basePath={basePath}
              bottleEntries={bottleEntries}
              userPerfumes={userPerfumes}
              bottleCountByPerfumeId={bottleCountByPerfumeId}
              liveInventoryStats={liveInventoryStats}
              filteredData={filteredData}
              paginatedPerfumes={paginatedPerfumes}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortSelectData={sortSelectData}
              selectedSort={selectedSort}
              onSortChange={(evt) => setSelectedSort(evt.target.value as SortOption)}
              houseOptions={houseOptions}
              selectedHouse={customFilterValues.house || "all"}
              onHouseChange={(evt) => setCustomFilterValue("house", evt.target.value)}
              minAmt={customFilterValues.minAmt || ""}
              maxAmt={customFilterValues.maxAmt || ""}
              onMinAmtChange={(evt) => setCustomFilterValue("minAmt", evt.target.value)}
              onMaxAmtChange={(evt) => setCustomFilterValue("maxAmt", evt.target.value)}
              hasActiveFilters={Boolean(hasActiveFilters)}
              onResetFilters={resetFilters}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          }
        />
      </div>
      </PageWrapper>
    </main>
  )
}

export default MyScentsPageClient
