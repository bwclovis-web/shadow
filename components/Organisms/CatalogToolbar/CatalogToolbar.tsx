"use client"

import { FiFilter } from "react-icons/fi"

import { Button } from "@/components/Atoms/Button/Button"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import Select from "@/components/Atoms/Select/Select"
import { ResultsViewToggle } from "@/components/Molecules/ResultsViewToggle"
import AlphabeticalNav from "@/components/Organisms/AlphabeticalNav"
import SearchBar from "@/components/Organisms/SearchBar/SearchBar"
import type { CatalogView } from "@/utils/catalog-params"
import { styleMerge } from "@/utils/styleUtils"

export type CatalogToolbarLabels = {
  searchPlaceholder: string
  sort: string
  filters: string
  filtersAria: string
  view: string
  gridView: string
  listView: string
  letterNav: string
}

export type CatalogToolbarProps = {
  searchType: "perfume" | "perfume-house"
  sortOptions: { id: string; name: string; label: string }[]
  sort: string
  onSortChange: (sort: string) => void
  activeFilterCount: number
  onOpenFilters: () => void
  view: CatalogView
  onViewChange: (view: CatalogView) => void
  letter: string | null
  onLetterSelect: (letter: string | null) => void
  onLetterHover?: (letter: string) => void
  labels: CatalogToolbarLabels
  /** Omits sort and filters (e.g. relevance-ranked name search results). */
  hideRefinements?: boolean
  className?: string
}

const controlHeight = "h-11"

const CatalogToolbar = ({
  searchType,
  sortOptions,
  sort,
  onSortChange,
  activeFilterCount,
  onOpenFilters,
  view,
  onViewChange,
  letter,
  onLetterSelect,
  onLetterHover,
  labels,
  hideRefinements = false,
  className,
}: CatalogToolbarProps) => {
  return (
    <OrnamentalFrame
      size="standard"
      className={styleMerge("bg-noir-black/40", className)}
    >
      <div className="space-y-4 p-3 md:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex">
          <div className="min-w-0 lg:flex-1">
            <SearchBar
              searchType={searchType}
              placeholder={labels.searchPlaceholder}
              className="h-11 py-0 text-sm md:py-0 md:text-base"
            />
          </div>
          {hideRefinements ? null : (
            <div className="col-span-2 flex items-center gap-2 md:gap-3">
              <Select
                selectId={`${searchType}-catalog-sort`}
                ariaLabel={labels.sort}
                selectData={sortOptions}
                value={sort}
                action={evt => onSortChange(evt.target.value)}
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
          )}
          <ResultsViewToggle
            view={view}
            onViewChange={onViewChange}
            labels={{
              view: labels.view,
              gridView: labels.gridView,
              listView: labels.listView,
            }}
            className="col-start-2 row-start-1"
          />
        </div>
        <AlphabeticalNav
          variant="compact"
          ariaLabel={labels.letterNav}
          selectedLetter={letter}
          onLetterSelect={onLetterSelect}
          onLetterHover={onLetterHover}
        />
      </div>
    </OrnamentalFrame>
  )
}

export default CatalogToolbar
