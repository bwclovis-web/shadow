"use client"

import { useEffect, useState } from "react"

import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { ResultsViewToggle } from "@/components/Molecules/ResultsViewToggle"
import SearchBar from "@/components/Organisms/SearchBar/SearchBar"
import type { SeekingOwnedUrlState } from "@/utils/seeking-params"
import type { SeekingView, SeekingVisibilityFilter } from "@/utils/seeking-constants"
import { styleMerge } from "@/utils/styleUtils"

export type SeekingToolbarLabels = {
  searchPlaceholder: string
  /** Already formatted with counts, e.g. "All (12)". */
  visibilityAll: string
  visibilityPublic: string
  visibilityPrivate: string
  visibilityGroupLabel: string
  viewLabel: string
  gridView: string
  listView: string
}

type SeekingToolbarProps = {
  state: SeekingOwnedUrlState
  labels: SeekingToolbarLabels
  onSearchCommit: (search: string) => void
  onVisibilityChange: (visibility: SeekingVisibilityFilter) => void
  onViewChange: (view: SeekingView) => void
  disabled?: boolean
}

const pillClass = (active: boolean) =>
  styleMerge(
    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    active
      ? "border-noir-gold bg-noir-gold text-noir-black"
      : "border-noir-gold/40 bg-noir-black/40 text-noir-gold hover:border-noir-gold/70"
  )

const SeekingToolbar = ({
  state,
  labels,
  onSearchCommit,
  onVisibilityChange,
  onViewChange,
  disabled = false,
}: SeekingToolbarProps) => {
  const [draftSearch, setDraftSearch] = useState(state.search)

  useEffect(() => {
    setDraftSearch(state.search)
  }, [state.search])

  const commitSearch = (raw: string) => {
    onSearchCommit(raw)
  }

  return (
    <OrnamentalFrame size="standard" className="bg-noir-black/40">
      <div className="space-y-4 p-3 md:p-4">
        <div className="min-w-0">
          <SearchBar
            searchType="perfume"
            inputId="seeking-search"
            placeholder={labels.searchPlaceholder}
            className="h-11 py-0 text-sm md:py-0 md:text-base"
            inputValue={draftSearch}
            disabled={disabled}
            clearInputOnSelect={false}
            onInputChange={value => {
              setDraftSearch(value)
              if (value === "" && state.search !== "") {
                commitSearch("")
              }
            }}
            action={item => {
              setDraftSearch(item.name)
              commitSearch(item.name)
            }}
            onQueryCommit={commitSearch}
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={labels.visibilityGroupLabel}
          >
            <button
              type="button"
              disabled={disabled}
              className={pillClass(state.visibility === "all")}
              aria-pressed={state.visibility === "all"}
              onClick={() => onVisibilityChange("all")}
            >
              {labels.visibilityAll}
            </button>
            <button
              type="button"
              disabled={disabled}
              className={pillClass(state.visibility === "public")}
              aria-pressed={state.visibility === "public"}
              onClick={() => onVisibilityChange("public")}
            >
              {labels.visibilityPublic}
            </button>
            <button
              type="button"
              disabled={disabled}
              className={pillClass(state.visibility === "private")}
              aria-pressed={state.visibility === "private"}
              onClick={() => onVisibilityChange("private")}
            >
              {labels.visibilityPrivate}
            </button>
          </div>

          <ResultsViewToggle
            view={state.view}
            onViewChange={onViewChange}
            disabled={disabled}
            labels={{
              view: labels.viewLabel,
              gridView: labels.gridView,
              listView: labels.listView,
            }}
          />
        </div>
      </div>
    </OrnamentalFrame>
  )
}

export default SeekingToolbar
