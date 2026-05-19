"use client"

import { type ChangeEvent, useState, useCallback, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { Link } from "next-view-transitions"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { useSessionStore } from "@/hooks/sessionStore"

import { Button } from "@/components/Atoms/Button"
import VooDooDetails from "@/components/Atoms/VooDooDetails"
import Select from "@/components/Atoms/Select/Select"
import { PaginationBar } from "@/components/Molecules/PaginationBar"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import BulkInventoryGrid from "@/components/Containers/MyScents/BulkInventoryGrid/BulkInventoryGrid"
import CsvImportPanel from "@/components/Containers/MyScents/CsvImport/CsvImportPanel"
import AddToCollectionModal from "@/components/Organisms/AddToCollectionModal"
import type { OptimisticCollectionItem } from "@/hooks/useMyScentsForm"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import { useResponsivePageSize } from "@/hooks/useMediaQuery"
import { useDataWithFilters } from "@/hooks/useDataWithFilters"
import { normalizeRemoteImageSrc, validImageRegex } from "@/utils/styleUtils"
import InventoryStatsStrip from "@/components/Containers/MyScents/InventoryStatsStrip"
import DecantSplitsPanel from "@/components/Containers/MyScents/DecantSplit/DecantSplitsPanel"
import MyListingsPanel from "@/components/Containers/MyScents/MyListingsPanel"
import MyScentsViewTabs from "@/components/Containers/MyScents/MyScentsViewTabs"
import WishlistDemandSection from "@/components/Containers/MyScents/WishlistDemandSection"
import {
  getActiveListings,
  getBottleEntries,
  getInventoryListingStatus,
  getPausedListings,
  isActiveListing,
  isPausedListing,
  parseMl,
} from "@/lib/user-inventory"
import { computeCollectionCounts } from "@/lib/user-inventory-stats"
import type { UserInventoryStats } from "@/models/user-inventory-stats.server"
import type { TraderWantingUserListingEnriched } from "@/services/trade-match"
import type { MyScentsView, UserPerfumeForClient } from "@/types/my-scents-client"
import type { SortOption } from "@/utils/sortUtils"
import { styleMerge } from "@/utils/styleUtils"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"
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

const buildBottleLabel = (up: UserPerfumeForClient, bottleCount: number): string | null => {
  if (bottleCount < 2) return null
  const typeLabel = getPerfumeTypeLabel(up.type ?? undefined)
  const amtNum = parseFloat((up.amount ?? "").replace(/[^0-9.]/g, "") || "0")
  const amtStr = up.amount && up.amount !== "0" && !isNaN(amtNum) ? `${amtNum.toFixed(1)} ml` : null
  const parts = [typeLabel, amtStr].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : null
}

/** Keep client pause state when a soft navigation returns stale server listing fields. */
const mergeUserPerfumesWithServer = (
  local: UserPerfumeForClient[],
  server: UserPerfumeForClient[]
): UserPerfumeForClient[] => {
  if (local.length === 0) return server

  const serverById = new Map(server.map((up) => [up.id, up]))
  const merged = local.map((row) => {
    const fromServer = serverById.get(row.id)
    if (!fromServer) return row
    if (isPausedListing(row) && isActiveListing(fromServer)) {
      return {
        ...fromServer,
        available: "0",
        pausedAvailable: row.pausedAvailable ?? fromServer.pausedAvailable,
      }
    }
    if (isActiveListing(row) && isPausedListing(fromServer)) {
      return {
        ...fromServer,
        available: row.available,
        pausedAvailable: null,
      }
    }
    return { ...row, ...fromServer }
  })

  for (const row of server) {
    if (!local.some((up) => up.id === row.id)) {
      merged.push(row)
    }
  }

  return merged
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
  const [stats, setStats] = useState<UserInventoryStats>(inventoryStats)
  const t = useTranslations("myScents")
  const tSort = useTranslations("sortOptions")
  const tTabs = useTranslations("myScents.tabs")
  const tStatus = useTranslations("myScents.listingStatus")

  useEffect(() => {
    setUserPerfumes((prev) => mergeUserPerfumesWithServer(prev, initialUserPerfumes))
  }, [initialUserPerfumes])

  useEffect(() => {
    setStats(inventoryStats)
  }, [inventoryStats])

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
      setStats(data.inventoryStats as UserInventoryStats)
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

  const handleSortChange = useCallback(
    (evt: ChangeEvent<HTMLSelectElement>) => {
      setSelectedSort(evt.target.value as SortOption)
    },
    [setSelectedSort],
  )

  const handleHouseChange = useCallback(
    (evt: ChangeEvent<HTMLSelectElement>) => {
      setCustomFilterValue("house", evt.target.value)
    },
    [setCustomFilterValue],
  )

  const handleMinAmtChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      setCustomFilterValue("minAmt", evt.target.value)
    },
    [setCustomFilterValue],
  )

  const handleMaxAmtChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      setCustomFilterValue("maxAmt", evt.target.value)
    },
    [setCustomFilterValue],
  )

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
    <section>
      <TitleBanner
        imagePos="object-bottom"
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <div className="flex flex-wrap items-center gap-3">
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
      <div className="noir-border relative inner-container mx-auto my-6 p-4">
        <MyScentsViewTabs
          activeView={activeView}
          onViewChange={setActiveView}
          ariaLabel={tTabs("ariaLabel")}
          inventoryLabel={tTabs("inventory")}
          listingsLabel={tTabs("listings")}
          listingsCount={activeListings.length + pausedListings.length}
          listingsPanel={
            <>
              <DecantSplitsPanel />
              <MyListingsPanel
                activeListings={activeListings}
                pausedListings={pausedListings}
                basePath={basePath}
                onListingChange={handleListingChange}
              />
            </>
          }
          inventoryPanel={
            <>
              <h2 className="text-center text-xl text-noir-gold">{t("inventory.heading")}</h2>
              {bottleEntries.length > 0 && (
                <div className="mb-4 w-full">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder={t("search.placeholder")}
                  />
                </div>
              )}
              <VooDooDetails
                name="inventory-at-a-glance"
                type="primary"
                background="dark"
                summary={t("inventory.atAGlance")}
                className="mb-4 w-full"
                defaultOpen
              >
                <div className="px-3 pb-4 pt-2">
                  <InventoryStatsStrip stats={liveInventoryStats} />
                </div>
              </VooDooDetails>
              {bottleEntries.length > 0 && (
                <>
                  <div className="mb-2 flex w-full flex-col items-end justify-between gap-4 border-b border-t border-noir-gold py-4 md:flex-row">
                    <Select
                      selectId="my-scents-sort"
                      selectData={sortSelectData}
                      action={handleSortChange}
                      defaultId={selectedSort}
                      label={t("filters.sort")}
                      size="compact"
                    />

                    <Select
                      selectId="my-scents-house"
                      selectData={houseOptions}
                      action={handleHouseChange}
                      defaultId={customFilterValues.house || "all"}
                      label={t("filters.house")}
                      size="compact"
                    />

                    <div className="flex gap-2 items-end">
                <div className="flex flex-col items-start">
                  <label
                    htmlFor="my-scents-min-amt"
                    className="font-semibold text-lg mb-1 capitalize text-noir-gold text-shadow-lg text-shadow-noir-black/60 tracking-wide"
                  >
                    {t("filters.minAmount")}
                  </label>
                  <input
                    id="my-scents-min-amt"
                    type="number"
                    min={0}
                    step={1}
                    value={customFilterValues.minAmt || ""}
                    onChange={handleMinAmtChange}
                    className="w-24 bg-noir-black/90 px-2 py-2 text-noir-gold-100 border border-noir-gold rounded-sm font-semibold outline-none focus:outline-none focus:ring-2 focus:ring-noir-gold/50 focus:bg-noir-dark"
                  />
                </div>
                <div className="flex flex-col items-start">
                  <label
                    htmlFor="my-scents-max-amt"
                    className="font-semibold text-lg mb-1 capitalize text-noir-gold text-shadow-lg text-shadow-noir-black/60 tracking-wide"
                  >
                    {t("filters.maxAmount")}
                  </label>
                  <input
                    id="my-scents-max-amt"
                    type="number"
                    min={0}
                    step={1}
                    value={customFilterValues.maxAmt || ""}
                    onChange={handleMaxAmtChange}
                    className="w-24 bg-noir-black/90 px-2 py-2 text-noir-gold-100 border border-noir-gold rounded-sm font-semibold outline-none focus:outline-none focus:ring-2 focus:ring-noir-gold/50 focus:bg-noir-dark"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <Button
                  onClick={resetFilters}
                  variant="secondary"
                  size="sm"
                >
                  {t("filters.clearAll")}
                </Button>
              )}
            </div>
          </>
        )}
        {bottleEntries.length === 0 ? (
          <div>
            <p className="text-noir-gold-100 text-xl">
              {t("collection.empty.heading")}
            </p>
            <p className="text-noir-gold-500 italic">
              {t("collection.empty.subheading")}
            </p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="animate-fade-in">
            <p className="text-noir-gold-100 text-xl">
              {t("search.noResults")}
            </p>
            <p className="text-noir-gold-500 italic">
              {t("search.tryDifferent")}
            </p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <ul className="w-full animate-fade-in grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedPerfumes.map((userPerfume) => {
                const { perfume } = userPerfume
                const normalized = normalizeRemoteImageSrc(perfume.image)
                const imageSrc =
                  normalized && !validImageRegex.test(normalized)
                    ? normalized
                    : BOTTLE_PLACEHOLDER
                const bottleCount = bottleCountByPerfumeId.get(userPerfume.perfumeId) ?? 0
                const bottleLabel = buildBottleLabel(userPerfume, bottleCount)
                const listingStatus = getInventoryListingStatus(userPerfume, userPerfumes)
                return (
                  <li
                    key={userPerfume.id}
                    className="relative flex flex-col items-center justify-center border-4 border-double border-noir-gold p-1"
                  >
                    <span
                      className={styleMerge(
                        "absolute right-1 top-1 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        listingStatus === "listed"
                          ? "bg-noir-gold/30 text-noir-gold"
                          : listingStatus === "partiallyListed"
                            ? "bg-noir-gold/20 text-noir-gold-100"
                            : "bg-noir-black/60 text-noir-gold-500"
                      )}
                    >
                      {tStatus(listingStatus)}
                    </span>
                    <Link
                      href={`${basePath}/${userPerfume.id}`}
                      className="block"
                    >
                      <Image
                        src={imageSrc}
                        alt={perfume.name ?? "Perfume Bottle"}
                        priority={false}
                        width={192}
                        height={192}
                        quality={75}
                        className="w-48 h-48 object-cover rounded-lg mb-2 mx-auto dark:brightness-90"
                        sizes="(max-width: 768px) 50vw, 33vw"
                        style={
                          {
                            viewTransitionName: `perfume-image-${userPerfume.id}`,
                          } as React.CSSProperties
                        }
                      />
                      <span className="text-noir-gold">{perfume.name}</span>
                      {bottleLabel && (
                        <span className="block text-xs text-noir-gold-100 mt-1">{bottleLabel}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
            {totalPages > 1 && (
              <PaginationBar
                className="py-6"
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        )}
            </>
          }
        />
      </div>
    </section>
  )
}

export default MyScentsPageClient
