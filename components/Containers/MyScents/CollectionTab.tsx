"use client"

import { type ChangeEvent } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import Select from "@/components/Atoms/Select/Select"
import { PaginationBar } from "@/components/Molecules/PaginationBar"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import { CollectionGridItem } from "@/components/Containers/MyScents/CollectionGridItem"
import MyScentsStatsHeader from "@/components/Containers/MyScents/MyScentsStatsHeader"
import { getInventoryListingStatus } from "@/lib/user-inventory"
import { isCollectionItemInReview } from "@/lib/collection-review-status"
import type { UserInventoryStats } from "@/models/user-inventory-stats.server"
import type { UserPerfumeForClient } from "@/types/my-scents-client"
import type { SortOption } from "@/utils/sortUtils"

type CollectionTabProps = {
  basePath: string
  bottleEntries: UserPerfumeForClient[]
  userPerfumes: UserPerfumeForClient[]
  bottleCountByPerfumeId: Map<string, number>
  liveInventoryStats: UserInventoryStats
  filteredData: UserPerfumeForClient[]
  paginatedPerfumes: UserPerfumeForClient[]
  searchQuery: string
  onSearchChange: (value: string) => void
  sortSelectData: { id: string; name: string; label: string }[]
  selectedSort: SortOption
  onSortChange: (evt: ChangeEvent<HTMLSelectElement>) => void
  houseOptions: { id: string; name: string; label: string }[]
  selectedHouse: string
  onHouseChange: (evt: ChangeEvent<HTMLSelectElement>) => void
  minAmt: string
  maxAmt: string
  onMinAmtChange: (evt: ChangeEvent<HTMLInputElement>) => void
  onMaxAmtChange: (evt: ChangeEvent<HTMLInputElement>) => void
  hasActiveFilters: boolean
  onResetFilters: () => void
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const CollectionTab = ({
  basePath,
  bottleEntries,
  userPerfumes,
  bottleCountByPerfumeId,
  liveInventoryStats,
  filteredData,
  paginatedPerfumes,
  searchQuery,
  onSearchChange,
  sortSelectData,
  selectedSort,
  onSortChange,
  houseOptions,
  selectedHouse,
  onHouseChange,
  minAmt,
  maxAmt,
  onMinAmtChange,
  onMaxAmtChange,
  hasActiveFilters,
  onResetFilters,
  currentPage,
  totalPages,
  onPageChange,
}: CollectionTabProps) => {
  const t = useTranslations("myScents")
  const tStatus = useTranslations("myScents.listingStatus")

  return (
    <>
      <h2 className="text-center mb-4">{t("inventory.heading")}</h2>
      {bottleEntries.length > 0 && (
        <div className="mb-4 w-full">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t("search.placeholder")}
          />
        </div>
      )}
      <MyScentsStatsHeader stats={liveInventoryStats} />
      {bottleEntries.length > 0 && (
        <>
          <div className="mb-2 flex w-full flex-col items-end justify-between gap-4 border-b border-t border-noir-gold py-4 md:flex-row">
            <Select
              selectId="my-scents-sort"
              selectData={sortSelectData}
              action={onSortChange}
              defaultId={selectedSort}
              label={t("filters.sort")}
              size="compact"
            />

            <Select
              selectId="my-scents-house"
              selectData={houseOptions}
              action={onHouseChange}
              defaultId={selectedHouse || "all"}
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
                  value={minAmt || ""}
                  onChange={onMinAmtChange}
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
                  value={maxAmt || ""}
                  onChange={onMaxAmtChange}
                  className="w-24 bg-noir-black/90 px-2 py-2 text-noir-gold-100 border border-noir-gold rounded-sm font-semibold outline-none focus:outline-none focus:ring-2 focus:ring-noir-gold/50 focus:bg-noir-dark"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                onClick={onResetFilters}
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
              const listingStatus = getInventoryListingStatus(
                userPerfume,
                userPerfumes
              )
              return (
                <CollectionGridItem
                  key={userPerfume.id}
                  userPerfume={userPerfume}
                  basePath={basePath}
                  bottleCount={
                    bottleCountByPerfumeId.get(userPerfume.perfumeId) ?? 0
                  }
                  listingStatus={listingStatus}
                  inReview={isCollectionItemInReview(userPerfume)}
                  listingStatusLabel={tStatus(listingStatus)}
                />
              )
            })}
          </ul>
          {totalPages > 1 && (
            <PaginationBar
              className="py-6"
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          )}
        </div>
      )}
    </>
  )
}

export default CollectionTab
