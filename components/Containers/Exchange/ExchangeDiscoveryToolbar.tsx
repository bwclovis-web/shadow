"use client"

import type { ChangeEvent, ReactNode, RefObject } from "react"
import { FiFilter } from "react-icons/fi"
import { LuLayoutGrid, LuList } from "react-icons/lu"

import { Button } from "@/components/Atoms/Button/Button"
import Select from "@/components/Atoms/Select/Select"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import type { ExchangeGroupSort } from "@/utils/exchange-constants"
import { styleMerge } from "@/utils/styleUtils"

export type ExchangeBrowseView = "grid" | "list"

export type ExchangeDiscoveryToolbarLabels = {
  searchPlaceholder: string
  keyboardHint: string
  sort: string
  sortNameAsc: string
  sortNameDesc: string
  sortOffersNewest: string
  filters: string
  filtersAria: string
  view: string
  gridView: string
  listView: string
}

export type ExchangeDiscoveryToolbarProps = {
  searchId: string
  searchInputRef: RefObject<HTMLInputElement | null>
  searchValue: string
  onSearchChange: (value: string) => void
  activeFilterCount: number
  onOpenFilters: () => void
  sort: ExchangeGroupSort
  onSortChange: (sort: ExchangeGroupSort) => void
  view: ExchangeBrowseView
  onViewChange: (view: ExchangeBrowseView) => void
  labels: ExchangeDiscoveryToolbarLabels
  className?: string
}

const controlHeight = "h-11"

export const ExchangeDiscoveryToolbar = ({
  searchId,
  searchInputRef,
  searchValue,
  onSearchChange,
  activeFilterCount,
  onOpenFilters,
  sort,
  onSortChange,
  view,
  onViewChange,
  labels,
  className,
}: ExchangeDiscoveryToolbarProps) => {
  const sortOptions = [
    {
      id: "offers-newest",
      name: "offers-newest",
      label: labels.sortOffersNewest,
    },
    {
      id: "name-asc",
      name: "name-asc",
      label: labels.sortNameAsc,
    },
    {
      id: "name-desc",
      name: "name-desc",
      label: labels.sortNameDesc,
    },
  ]

  const viewButton = (
    value: ExchangeBrowseView,
    label: string,
    icon: ReactNode
  ) => (
    <Button
      type="button"
      variant={null}
      size={null}
      aria-pressed={view === value}
      aria-label={label}
      title={label}
      onClick={() => onViewChange(value)}
      className={styleMerge(
        `${controlHeight} flex items-center justify-center rounded-none border-0 px-3 transition-colors md:min-w-[3.25rem] md:px-4`,
        view === value
          ? "bg-noir-gold text-noir-black"
          : "bg-noir-black/60 text-noir-gold hover:bg-noir-gold/20"
      )}
    >
      {icon}
    </Button>
  )

  const handleSortChange = (evt: ChangeEvent<HTMLSelectElement>) => {
    onSortChange(evt.target.value as ExchangeGroupSort)
  }

  return (
    <div className={styleMerge("space-y-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchInput
            id={searchId}
            inputRef={searchInputRef}
            value={searchValue}
            onChange={onSearchChange}
            placeholder={labels.searchPlaceholder}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Select
            selectId="exchange-sort"
            ariaLabel={labels.sort}
            selectData={sortOptions}
            value={sort}
            action={handleSortChange}
            size="compact"
            className={`${controlHeight} min-w-0 flex-1 bg-noir-black/60 pr-0 text-sm sm:min-w-[14rem] sm:flex-none lg:min-w-[16rem]`}
          />
          <Button
            type="button"
            variant={activeFilterCount > 0 ? "primary" : "secondary"}
            size={null}
            aria-label={labels.filtersAria}
            onClick={onOpenFilters}
            className={`${controlHeight} flex w-auto shrink-0 items-center gap-2 px-3 text-sm md:px-4`}
          >
            <FiFilter className="h-4 w-4" aria-hidden />
            <span>{labels.filters}</span>
            <span
              aria-hidden
              className={styleMerge(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                activeFilterCount > 0
                  ? "bg-noir-black text-noir-gold"
                  : "border border-noir-gold/50 text-noir-gold-100"
              )}
            >
              {activeFilterCount}
            </span>
          </Button>
          <div
            role="group"
            aria-label={labels.view}
            className="ml-auto flex shrink-0 overflow-hidden rounded-sm border border-noir-gold sm:ml-0"
          >
            {viewButton(
              "grid",
              labels.gridView,
              <LuLayoutGrid className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
            )}
            {viewButton(
              "list",
              labels.listView,
              <LuList className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
            )}
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-noir-gold-500 lg:text-left">
        {labels.keyboardHint}
      </p>
    </div>
  )
}
