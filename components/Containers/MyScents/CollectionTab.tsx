"use client"

import { type ChangeEvent, type ReactNode, useCallback, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { Button, VooDooLink } from "@/components/Atoms/Button"
import Input from "@/components/Atoms/Input"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import Select from "@/components/Atoms/Select/Select"
import { CollectionGridItem } from "@/components/Containers/MyScents/CollectionGridItem"
import DestashEditorRail from "@/components/Containers/MyScents/DestashEditorRail/DestashEditorRail"
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
  /** Upsert listing after create/edit from the Collection rail. */
  onListingChange: (updated: UserPerfumeForClient) => void
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
  resultsView,
  onResultsViewChange,
  onListingChange,
}: CollectionTabProps) => {
  const t = useTranslations("myScents")
  const tStatus = useTranslations("myScents.listingStatus")
  const tView = useTranslations("myScents.collection.toolbar")
  const tListHeaders = useTranslations("myScents.collection.listHeaders")
  const listRef = useRef<HTMLUListElement>(null)
  const pageIds = paginatedPerfumes.map(item => item.id).join(",")
  const isList = resultsView === "list"
  const [filtersOpen, setFiltersOpen] = useState(hasActiveFilters)
  const [createFromBottle, setCreateFromBottle] =
    useState<UserPerfumeForClient | null>(null)

  const handleCreateDestash = useCallback((bottle: UserPerfumeForClient) => {
    setCreateFromBottle(bottle)
  }, [])

  const handleCloseCreateRail = useCallback(() => {
    setCreateFromBottle(null)
  }, [])

  useGsapStagger(listRef, {
    selector: "[data-collection-card]",
    deps: [pageIds, currentPage, resultsView],
    enabled: paginatedPerfumes.length > 0,
    ...CARD_STAGGER_DEFAULT,
  })

  return (
    <>
      <MyScentsStatsHeader stats={liveInventoryStats} />

      {bottleEntries.length > 0 && (
        <div className="mb-6 space-y-3">
          {/* Primary bar: Add · Search · Sort · Grid/List — shared h-11 controls */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
            <div className="flex h-11 shrink-0 items-stretch [&>button]:h-full [&>button]:min-h-11 [&>button]:w-auto [&>button]:px-3">
              {addToCollection}
            </div>
            <div className="min-w-0 flex-1">
              <SearchInput
                value={searchQuery}
                onChange={onSearchChange}
                placeholder={t("search.placeholder")}
                size="filter"
              />
            </div>
            <div className="w-full shrink-0 lg:w-52 [&_select]:min-h-11 [&_select]:box-border [&_select]:py-2">
              <Select
                selectId="my-scents-sort"
                selectData={sortSelectData}
                action={onSortChange}
                defaultId={selectedSort}
                label={t("filters.sort")}
                size="compact"
                className="w-full max-w-none"
              />
            </div>
            <div className="flex shrink-0 items-end self-end">
              <ResultsViewToggle
                view={resultsView}
                onViewChange={onResultsViewChange}
                labels={{
                  view: tView("view"),
                  gridView: tView("gridView"),
                  listView: tView("listView"),
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => setFiltersOpen(open => !open)}
              aria-expanded={filtersOpen}
            >
              {filtersOpen ? tView("hideFilters") : tView("moreFilters")}
              {hasActiveFilters && !filtersOpen ? " ·" : ""}
            </Button>
            {hasActiveFilters && (
              <Button onClick={onResetFilters} variant="secondary" size="sm">
                {t("filters.clearAll")}
              </Button>
            )}
          </div>

          {filtersOpen && (
            <div className="flex w-full flex-col items-stretch gap-4 border border-noir-gold/25 bg-noir-black/20 p-3 md:flex-row md:items-end md:gap-4 md:p-4">
              <div className="min-w-0 flex-1 [&_select]:min-h-11 [&_select]:box-border [&_select]:py-2">
                <Select
                  selectId="my-scents-house"
                  selectData={houseOptions}
                  action={onHouseChange}
                  defaultId={selectedHouse || "all"}
                  label={t("filters.house")}
                  size="compact"
                  className="w-full max-w-none"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  inputId="my-scents-min-amt"
                  inputType="number"
                  label={t("filters.minAmount")}
                  min={0}
                  step={1}
                  value={minAmt || ""}
                  onChange={onMinAmtChange}
                  className="w-28 min-h-11 !border !border-solid !border-noir-gold bg-noir-black/90 px-2 py-2 text-sm text-noir-gold-100"
                />
                <Input
                  inputId="my-scents-max-amt"
                  inputType="number"
                  label={t("filters.maxAmount")}
                  min={0}
                  step={1}
                  value={maxAmt || ""}
                  onChange={onMaxAmtChange}
                  className="w-28 min-h-11 !border !border-solid !border-noir-gold bg-noir-black/90 px-2 py-2 text-sm text-noir-gold-100"
                />
              </div>
            </div>
          )}
        </div>
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
        <div className={isList ? "border border-noir-gold/30 bg-noir-black/15 p-2 md:p-3" : undefined}>
          {isList && (
            <div
              className="mb-1 hidden border-b border-noir-gold/40 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-noir-gold-100 md:grid md:grid-cols-[minmax(0,1.6fr)_5.5rem_5.5rem_minmax(11rem,auto)] md:gap-4"
              aria-hidden="true"
            >
              <span>{tListHeaders("fragrance")}</span>
              <span>{tListHeaders("owned")}</span>
              <span>{tListHeaders("listed")}</span>
              <span className="text-right">{tListHeaders("actions")}</span>
            </div>
          )}
          <ul
            ref={listRef}
            className={
              isList
                ? "flex w-full flex-col"
                : "grid w-full grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 min-[1200px]:!grid-cols-3"
            }
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
                  variant={resultsView}
                  onCreateDestash={handleCreateDestash}
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

      <DestashEditorRail
        createFromBottle={createFromBottle}
        userPerfumes={userPerfumes}
        basePath={basePath}
        onClose={handleCloseCreateRail}
        onListingChange={onListingChange}
      />
    </>
  )
}

export default CollectionTab
