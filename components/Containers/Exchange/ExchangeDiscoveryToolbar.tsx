"use client"

import type { RefObject } from "react"
import { FiFilter } from "react-icons/fi"
import { LuLayoutGrid, LuList } from "react-icons/lu"

import { Button } from "@/components/Atoms/Button/Button"
import Select from "@/components/Atoms/Select/Select"
import SearchInput from "@/components/Molecules/SearchInput/SearchInput"
import { styleMerge } from "@/utils/styleUtils"

export type ExchangeBrowseView = "grid" | "list"

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
}

export type ExchangeDiscoveryToolbarProps = {
  searchId: string
  searchInputRef: RefObject<HTMLInputElement | null>
  searchValue: string
  onSearchChange: (value: string) => void
  activeFilterCount: number
  onOpenFilters: () => void
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
  view,
  onViewChange,
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

  const viewButton = (
    value: ExchangeBrowseView,
    label: string,
    icon: React.ReactNode
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
        `${controlHeight} flex w-11 items-center justify-center rounded-none border-0 transition-colors`,
        view === value
          ? "bg-noir-gold text-noir-black"
          : "bg-noir-black/60 text-noir-gold hover:bg-noir-gold/20"
      )}
    >
      {icon}
    </Button>
  )

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
          {viewButton(
            "grid",
            labels.gridView,
            <LuLayoutGrid className="h-5 w-5" aria-hidden />
          )}
          {viewButton(
            "list",
            labels.listView,
            <LuList className="h-5 w-5" aria-hidden />
          )}
        </div>
      </div>
      <p className="text-center text-xs text-noir-gold-500 lg:text-left">
        {labels.keyboardHint}
      </p>
    </div>
  )
}
