"use client"

import { type ChangeEvent, type ReactNode, useRef } from "react"
import { useTranslations } from "next-intl"

import { Button, VooDooLink } from "@/components/Atoms/Button"
import Input from "@/components/Atoms/Input"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import Select from "@/components/Atoms/Select/Select"
import { CollectionGridItem } from "@/components/Containers/MyScents/CollectionGridItem"
import MyScentsStatsHeader from "@/components/Containers/MyScents/MyScentsStatsHeader"
import { PaginationBar } from "@/components/Molecules/PaginationBar"
import {
  ResultsViewToggle,
  type ResultsView,
} from "@/components/Molecules/ResultsViewToggle"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import { THE_ARCHIVE_PATH, THE_COLLECTORS_GUIDE_PATH } from "@/constants/routes"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { isCollectionItemInReview } from "@/lib/collection-review-status"
import { getInventoryListingStatus } from "@/lib/user-inventory"
import type { UserInventoryStats } from "@/models/user-inventory-stats.server"
import type { UserPerfumeForClient } from "@/types/my-scents-client"
import { CARD_STAGGER_DEFAULT } from "@/utils/card-motion"
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
  /** Existing Add-to-collection modal trigger (same modal as before). */
  addToCollection: ReactNode
  resultsView: ResultsView
  onResultsViewChange: (view: ResultsView) => void
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
  addToCollection,
}: CollectionTabProps) => {
  const t = useTranslations("myScents")
  const tStatus = useTranslations("myScents.listingStatus")
  const tView = useTranslations("myScents.collection.toolbar")
  const gridRef = useRef<HTMLUListElement>(null)
  const pageIds = paginatedPerfumes.map(item => item.id).join(",")

  useGsapStagger(gridRef, {
    selector: "[data-collection-card]",
    deps: [pageIds, currentPage],
    enabled: paginatedPerfumes.length > 0,
    ...CARD_STAGGER_DEFAULT,
  })

  return (
    <>
      <h2 className="mb-4 text-center">{t("inventory.heading")}</h2>
      <MyScentsStatsHeader stats={liveInventoryStats} />

      {bottleEntries.length > 0 && (
        <OrnamentalFrame size="standard" className="mb-4 bg-noir-black/40">
          <div className="space-y-4 p-3 md:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {addToCollection}
              </div>
              <div className="min-w-0 flex-1">
                <SearchInput
                  value={searchQuery}
                  onChange={onSearchChange}
                  placeholder={t("search.placeholder")}
                />
              </div>
              <ResultsViewToggle
                view="grid"
                onViewChange={() => undefined}
                disabledViews={["list"]}
                labels={{
                  view: tView("view"),
                  gridView: tView("gridView"),
                  listView: tView("listViewPending"),
                }}
              />
            </div>

            <div className="flex w-full flex-col items-stretch justify-between gap-4 border-t border-noir-gold/40 pt-4 md:flex-row md:items-end">
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
                <Input
                  inputId="my-scents-min-amt"
                  inputType="number"
                  label={t("filters.minAmount")}
                  min={0}
                  step={1}
                  value={minAmt || ""}
                  onChange={onMinAmtChange}
                  className="w-24"
                />
                <Input
                  inputId="my-scents-max-amt"
                  inputType="number"
                  label={t("filters.maxAmount")}
                  min={0}
                  step={1}
                  value={maxAmt || ""}
                  onChange={onMaxAmtChange}
                  className="w-24"
                />
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
          </div>
        </OrnamentalFrame>
      )}

      {bottleEntries.length === 0 ? (
        <div className="space-y-4 rounded-md border-2 border-noir-light bg-noir-gray/80 px-4 py-8 text-center">
          <p className="text-xl text-noir-gold-100">
            {t("collection.empty.heading")}
          </p>
          <p className="italic text-noir-gold-500">
            {t("collection.empty.subheading")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {addToCollection}
            <VooDooLink url={THE_ARCHIVE_PATH} variant="primary" background="gold">
              {t("collection.empty.browseArchive")}
            </VooDooLink>
            <VooDooLink url="/scent-quiz" variant="secondary">
              {t("collection.empty.takeQuiz")}
            </VooDooLink>
            <PrefetchLink
              href={THE_COLLECTORS_GUIDE_PATH}
              className="text-sm text-noir-gold underline-offset-4 hover:underline"
            >
              {t("collection.empty.collectorsGuide")}
            </PrefetchLink>
          </div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="animate-fade-in">
          <p className="text-xl text-noir-gold-100">
            {t("search.noResults")}
          </p>
          <p className="italic text-noir-gold-500">
            {t("search.tryDifferent")}
          </p>
        </div>
      ) : (
        <OrnamentalFrame size="standard" className="bg-noir-black/20">
          <div className="p-3 md:p-4">
            <ul
              ref={gridRef}
              className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 min-[1200px]:grid-cols-3"
            >
              {paginatedPerfumes.map(userPerfume => {
                const listingStatus = getInventoryListingStatus(
                  userPerfume,
                  userPerfumes
                )
                return (
                  <CollectionGridItem
                    key={userPerfume.id}
                    userPerfume={userPerfume}
                    allUserPerfumes={userPerfumes}
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
        </OrnamentalFrame>
      )}
    </>
  )
}

export default CollectionTab
