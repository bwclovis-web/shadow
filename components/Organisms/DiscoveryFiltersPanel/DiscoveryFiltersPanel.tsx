"use client"

import { useEffect, useState, type FC } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import Input from "@/components/Atoms/Input/Input"
import { SeasonSelectionToggleRow } from "@/components/Containers/Perfume/PerfumeSeasonVote/SeasonSelectionToggleRow"
import { FilterPanelSection } from "@/components/Molecules/FilterPanelSection"
import {
  HouseAutocomplete,
  type HouseAutocompleteOption,
} from "@/components/Molecules/HouseAutocomplete"
import TagSearch from "@/components/Organisms/TagSearch/TagSearch"
import type { Tag } from "@/lib/queries/tags"
import {
  emptyDiscoveryFilters,
  type PerfumeDiscoveryFilters,
  seasonsArrayToSelection,
  selectionToSeasonsArray,
} from "@/utils/discovery-filters"
import { styleMerge } from "@/utils/styleUtils"

export type DiscoveryFiltersPanelProps = {
  value: PerfumeDiscoveryFilters
  onChange: (next: PerfumeDiscoveryFilters) => void
  /** Hydrated note tags for URL `notes` ids (names for chips). */
  initialNoteTags: Tag[]
  /** Hydrated house when URL has `house`. */
  initialHouse: HouseAutocompleteOption | null
  labels: {
    notesTitle: string
    notesDescription: string
    notesSearchLabel: string
    seasonTitle: string
    seasonDescription: string
    houseTitle: string
    houseSearchLabel: string
    houseClear: string
    priceTitle: string
    priceDescription: string
    minLabel: string
    maxLabel: string
    clearAll: string
  }
  className?: string
}

export const DiscoveryFiltersPanel: FC<DiscoveryFiltersPanelProps> = ({
  value,
  onChange,
  initialNoteTags,
  initialHouse,
  labels,
  className,
}) => {
  const [minStr, setMinStr] = useState(
    () => (value.minPrice != null ? String(value.minPrice) : "")
  )
  const [maxStr, setMaxStr] = useState(
    () => (value.maxPrice != null ? String(value.maxPrice) : "")
  )

  const [localHouse, setLocalHouse] = useState<HouseAutocompleteOption | null>(
    null
  )

  useEffect(() => {
    if (!value.houseId) {
      setLocalHouse(null)
      return
    }
    if (initialHouse && initialHouse.id === value.houseId) {
      setLocalHouse(null)
    }
  }, [initialHouse, value.houseId])

  useEffect(() => {
    setMinStr(value.minPrice != null ? String(value.minPrice) : "")
  }, [value.minPrice])

  useEffect(() => {
    setMaxStr(value.maxPrice != null ? String(value.maxPrice) : "")
  }, [value.maxPrice])

  const houseSelected =
    localHouse ??
    (initialHouse && initialHouse.id === value.houseId
      ? initialHouse
      : value.houseId
        ? { id: value.houseId, name: value.houseId }
        : null)

  const commitPrice = () => {
    const minTrim = minStr.trim()
    const maxTrim = maxStr.trim()
    const minV = minTrim === "" ? null : Number.parseFloat(minTrim)
    const maxV = maxTrim === "" ? null : Number.parseFloat(maxTrim)
    const minPrice =
      minV != null && Number.isFinite(minV) && minV >= 0 ? minV : null
    const maxPrice =
      maxV != null && Number.isFinite(maxV) && maxV >= 0 ? maxV : null
    let nextMin = minPrice
    let nextMax = maxPrice
    if (
      nextMin != null &&
      nextMax != null &&
      nextMin > nextMax
    ) {
      ;[nextMin, nextMax] = [nextMax, nextMin]
    }
    onChange({
      ...value,
      minPrice: nextMin,
      maxPrice: nextMax,
    })
  }

  return (
    <div
      className={styleMerge(
        "space-y-6 rounded-md border border-noir-gold bg-noir-dark p-4",
        className
      )}
    >
      <FilterPanelSection title={labels.notesTitle} description={labels.notesDescription}>
        <TagSearch
          inputId="exchange-discovery-notes"
          label={labels.notesSearchLabel}
          data={initialNoteTags}
          allowCreate={false}
          surface="dark"
          selectedLayout="flow"
          onChange={tags =>
            onChange({ ...value, noteIds: tags.map(t => t.id) })
          }
        />
      </FilterPanelSection>

      <FilterPanelSection title={labels.seasonTitle} description={labels.seasonDescription}>
        <SeasonSelectionToggleRow
          selection={seasonsArrayToSelection(value.seasons)}
          onChange={sel =>
            onChange({
              ...value,
              seasons: selectionToSeasonsArray(sel),
            })
          }
        />
      </FilterPanelSection>

      <FilterPanelSection title={labels.houseTitle}>
        <HouseAutocomplete
          inputId="exchange-discovery-house"
          label={labels.houseSearchLabel}
          clearLabel={labels.houseClear}
          selected={houseSelected}
          onSelect={house => {
            setLocalHouse(house)
            onChange({ ...value, houseId: house?.id ?? null })
          }}
        />
      </FilterPanelSection>

      <FilterPanelSection title={labels.priceTitle} description={labels.priceDescription}>
        <div className="grid grid-cols-2 gap-3">
          <Input
            inputId="exchange-discovery-min-price"
            inputType="number"
            shading
            label={labels.minLabel}
            min={0}
            step="any"
            value={minStr}
            onChange={e => setMinStr(e.target.value)}
            onBlur={commitPrice}
          />
          <Input
            inputId="exchange-discovery-max-price"
            inputType="number"
            shading
            label={labels.maxLabel}
            min={0}
            step="any"
            value={maxStr}
            onChange={e => setMaxStr(e.target.value)}
            onBlur={commitPrice}
          />
        </div>
      </FilterPanelSection>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        background="gold"
        className="w-full"
        onClick={() => {
          onChange(emptyDiscoveryFilters())
          setMinStr("")
          setMaxStr("")
          setLocalHouse(null)
        }}
      >
        {labels.clearAll}
      </Button>
    </div>
  )
}
