"use client"

import type { RefObject } from "react"
import { FiFilter } from "react-icons/fi"
import { LuLayoutGrid, LuList } from "react-icons/lu"

import { Button } from "@/components/Atoms/Button/Button"
import Select from "@/components/Atoms/Select/Select"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import { styleMerge } from "@/utils/styleUtils"

export type ExchangeDiscoveryToolbarLabels = {
  searchPlaceholder: string
  keyboardHint: string
  sort: string
  sortNameAsc: string
  filters: string
  filtersAria: string
  view: string
  gridView: string
  listView: string
  listViewUnavailable: string
}

export type ExchangeDiscoveryToolbarProps = {
  searchId: string
  searchInputRef: RefObject<HTMLInputElement | null>
  searchValue: string
  onSearchChange: (value: string) => void
  activeFilterCount: number
  onOpenFilters: () => void
  labels: ExchangeDiscoveryToolbarLabels
  className?: string
}

const controlHeight = "h-11"

/**
 * Exchange browse toolbar (search + sort placeholder + Filters + view).
 * Sort/list are non-functional until later data/list steps; grid is the only live view.
 */
export const ExchangeDiscoveryToolbar = ({
  searchId,
  searchInputRef,
  searchValue,
  onSearchChange,
  activeFilterCount,
  onOpenFilters,
  labels,
  className,
}: ExchangeDiscoveryToolbarProps) => {
  const sortOptions = [
    {
      id: "name-asc",
      name: "name-asc",
      label: labels.sortNameAsc,
    },
  ]

  return (
    <div className={styleMerge("space-y-3", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:flex-wrap">
        <div className="min-w-0 lg:min-w-[16rem] lg:flex-1">
          <SearchInput
            id={searchId}
            inputRef={searchInputRef}
            value={searchValue}
            onChange={onSearchChange}
            placeholder={labels.searchPlaceholder}
          />
        </div>

        <div className="col-span-2 flex flex-wrap items-center gap-2 md:gap-3 lg:contents">
          <Select
            selectId="exchange-sort"
            ariaLabel={labels.sort}
            selectData={sortOptions}
            value="name-asc"
            action={() => undefined}
            disabled
            size="compact"
            className={`${controlHeight} w-full min-w-0 max-w-none flex-1 bg-noir-black/60 pr-0 text-sm lg:w-auto lg:min-w-[12rem] lg:flex-none`}
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
        </div>

        <div
          role="group"
          aria-label={labels.view}
          className="col-start-2 row-start-1 flex shrink-0 overflow-hidden rounded-sm border border-noir-gold"
        >
          <Button
            type="button"
            variant={null}
            size={null}
            aria-pressed
            aria-label={labels.gridView}
            title={labels.gridView}
            className={`${controlHeight} flex w-11 items-center justify-center rounded-none border-0 bg-noir-gold text-noir-black`}
          >
            <LuLayoutGrid className="h-5 w-5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant={null}
            size={null}
            disabled
            aria-pressed={false}
            aria-label={labels.listViewUnavailable}
            title={labels.listViewUnavailable}
            className={`${controlHeight} flex w-11 items-center justify-center rounded-none border-0 bg-noir-black/60 text-noir-gold/40`}
          >
            <LuList className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>
      <p className="text-center text-xs text-noir-gold-500 lg:text-left">
        {labels.keyboardHint}
      </p>
    </div>
  )
}
