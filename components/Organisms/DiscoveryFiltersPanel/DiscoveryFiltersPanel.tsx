"use client"

import { useEffect, useId, useMemo, useState, type FC } from "react"

import CheckBox from "@/components/Atoms/CheckBox/CheckBox"
import Input from "@/components/Atoms/Input/Input"
import Select from "@/components/Atoms/Select/Select"
import { SeasonSelectionToggleRow } from "@/components/Containers/Perfume/PerfumeSeasonVote/SeasonSelectionToggleRow"
import { FilterPanelSection } from "@/components/Molecules/FilterPanelSection"
import { FilterToggleGroup } from "@/components/Molecules/FilterToggleGroup"
import {
  HouseAutocomplete,
  type HouseAutocompleteOption,
} from "@/components/Molecules/HouseAutocomplete"
import TagSearch from "@/components/Organisms/TagSearch/TagSearch"
import type { Tag } from "@/lib/queries/tags"
import { CATALOG_MAX_SELECTIONS } from "@/utils/catalog-params"
import {
  DISCOVERY_LISTING_CONDITIONS,
  DISCOVERY_MIN_REP_OPTIONS,
  DISCOVERY_TRADE_PREFERENCES,
  EXCHANGE_BOTTLE_TYPES,
  EXCHANGE_REGION_BUCKETS,
  type DiscoveryListingCondition,
  type DiscoveryMinRep,
  type DiscoveryTradePreference,
  type ExchangeBottleType,
  type ExchangeRegionBucket,
  type PerfumeDiscoveryFilters,
  seasonsArrayToSelection,
  selectionToSeasonsArray,
} from "@/utils/discovery-filters"
import { styleMerge } from "@/utils/styleUtils"

export type DiscoveryFiltersPanelLabels = {
  notesTitle: string
  notesDescription: string
  notesSearchLabel: string
  notesSearchPlaceholder?: string
  notesEmptyLabel?: string
  notesSearching?: string
  notesNoMatches?: string
  notesSearchError?: string
  seasonTitle: string
  seasonDescription: string
  houseTitle: string
  houseSearchLabel: string
  houseClear: string
  houseSearching?: string
  houseNoMatches?: string
  houseSearchError?: string
  priceTitle: string
  priceDescription: string
  minLabel: string
  maxLabel: string
  tradePrefTitle: string
  tradePrefDescription: string
  tradePrefAria: string
  tradePrefCash: string
  tradePrefTrade: string
  tradePrefBoth: string
  bottleTitle: string
  bottleDescription: string
  bottleAria: string
  bottleFull: string
  bottlePartial: string
  bottleSample: string
  bottleDecant: string
  conditionTitle: string
  conditionDescription: string
  conditionAria: string
  conditionLabels: Record<DiscoveryListingCondition, string>
  regionTitle: string
  regionDescription: string
  regionLabel: string
  regionAll: string
  regionUS: string
  regionUK: string
  regionAU: string
  regionEU: string
  regionOther: string
  hasPhotosLabel: string
  hasPhotosDescription: string
  hasPhotosToggle: string
  minRepTitle: string
  minRepDescription: string
  minRepLabel: string
  minRepAll: string
}

export type DiscoveryFiltersPanelProps = {
  value: PerfumeDiscoveryFilters
  onChange: (next: PerfumeDiscoveryFilters) => void
  /** Hydrated note tags for URL `notes` ids (names for chips). */
  initialNoteTags: Tag[]
  /** Hydrated house when URL has `house`. */
  initialHouse: HouseAutocompleteOption | null
  labels: DiscoveryFiltersPanelLabels
  className?: string
}

const TRADE_PREF_OPTIONS: DiscoveryTradePreference[] = [...DISCOVERY_TRADE_PREFERENCES]
const BOTTLE_OPTIONS: ExchangeBottleType[] = [...EXCHANGE_BOTTLE_TYPES]
const CONDITION_OPTIONS: DiscoveryListingCondition[] = [...DISCOVERY_LISTING_CONDITIONS]

const resolveDraftNoteTags = (
  noteIds: string[],
  initialNoteTags: Tag[],
  previous: Tag[]
): Tag[] => {
  const byId = new Map<string, Tag>()
  for (const tag of initialNoteTags) byId.set(tag.id, tag)
  for (const tag of previous) byId.set(tag.id, tag)
  return noteIds.map(id => byId.get(id) ?? { id, name: id })
}

export const DiscoveryFiltersPanel: FC<DiscoveryFiltersPanelProps> = ({
  value,
  onChange,
  initialNoteTags,
  initialHouse,
  labels,
  className,
}) => {
  const regionSelectId = useId()
  const minRepSelectId = useId()
  const [minStr, setMinStr] = useState(
    () => (value.minPrice != null ? String(value.minPrice) : "")
  )
  const [maxStr, setMaxStr] = useState(
    () => (value.maxPrice != null ? String(value.maxPrice) : "")
  )

  const [localHouse, setLocalHouse] = useState<HouseAutocompleteOption | null>(
    null
  )
  const [draftNoteTags, setDraftNoteTags] = useState<Tag[]>(() =>
    resolveDraftNoteTags(value.noteIds, initialNoteTags, [])
  )

  useEffect(() => {
    setDraftNoteTags(prev =>
      resolveDraftNoteTags(value.noteIds, initialNoteTags, prev)
    )
  }, [value.noteIds, initialNoteTags])

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

  const noteSearchMessages = useMemo(
    () => ({
      loading: labels.notesSearching ?? "Searching…",
      empty: labels.notesNoMatches ?? "No matches found",
      formatError: (err: string) =>
        labels.notesSearchError
          ? `${labels.notesSearchError} (${err})`
          : err,
    }),
    [
      labels.notesSearching,
      labels.notesNoMatches,
      labels.notesSearchError,
    ]
  )

  const houseSearchMessages = useMemo(
    () => ({
      loading: labels.houseSearching ?? labels.notesSearching ?? "Searching…",
      empty: labels.houseNoMatches ?? labels.notesNoMatches ?? "No matches found",
      formatError: (err: string) =>
        labels.houseSearchError ?? labels.notesSearchError ?? err,
    }),
    [
      labels.houseSearching,
      labels.houseNoMatches,
      labels.houseSearchError,
      labels.notesSearching,
      labels.notesNoMatches,
      labels.notesSearchError,
    ]
  )

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
    if (nextMin != null && nextMax != null && nextMin > nextMax) {
      ;[nextMin, nextMax] = [nextMax, nextMin]
    }
    onChange({
      ...value,
      minPrice: nextMin,
      maxPrice: nextMax,
    })
  }

  const regionLabelFor = (bucket: ExchangeRegionBucket): string => {
    switch (bucket) {
      case "US":
        return labels.regionUS
      case "UK":
        return labels.regionUK
      case "AU":
        return labels.regionAU
      case "EU":
        return labels.regionEU
      case "other":
        return labels.regionOther
      default:
        return bucket
    }
  }

  const tradePrefOptions = TRADE_PREF_OPTIONS.map(pref => ({
    value: pref,
    label:
      pref === "cash"
        ? labels.tradePrefCash
        : pref === "trade"
          ? labels.tradePrefTrade
          : labels.tradePrefBoth,
  }))

  const bottleOptions = BOTTLE_OPTIONS.map(bottle => ({
    value: bottle,
    label:
      bottle === "full"
        ? labels.bottleFull
        : bottle === "partial"
          ? labels.bottlePartial
          : bottle === "sample"
            ? labels.bottleSample
            : labels.bottleDecant,
  }))

  const conditionOptions = CONDITION_OPTIONS.map(condition => ({
    value: condition,
    label: labels.conditionLabels[condition],
  }))

  const regionSelectData = [
    { id: "", name: "all", label: labels.regionAll },
    ...EXCHANGE_REGION_BUCKETS.map(bucket => ({
      id: bucket,
      name: bucket,
      label: regionLabelFor(bucket),
    })),
  ]

  const minRepSelectData = [
    { id: "", name: "all", label: labels.minRepAll },
    ...DISCOVERY_MIN_REP_OPTIONS.map(score => ({
      id: String(score),
      name: String(score),
      label: `${score}+`,
    })),
  ]

  return (
    <div
      className={styleMerge(
        "space-y-6 rounded-md border border-noir-gold bg-noir-dark p-4",
        className
      )}
    >
      <FilterPanelSection
        title={labels.notesTitle}
        description={labels.notesDescription}
      >
        <TagSearch
          inputId="exchange-discovery-notes"
          label={labels.notesSearchLabel}
          searchInputLabel={labels.notesSearchLabel}
          searchLabelClassName="sr-only"
          placeholder={labels.notesSearchPlaceholder}
          emptyLabel={labels.notesEmptyLabel}
          data={draftNoteTags}
          allowCreate={false}
          maxSelections={CATALOG_MAX_SELECTIONS}
          surface="dark"
          selectedLayout="flow"
          messages={noteSearchMessages}
          onChange={tags => {
            setDraftNoteTags(tags)
            onChange({ ...value, noteIds: tags.map(t => t.id) })
          }}
        />
      </FilterPanelSection>

      <FilterPanelSection
        title={labels.seasonTitle}
        description={labels.seasonDescription}
      >
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
          messages={houseSearchMessages}
          onSelect={house => {
            setLocalHouse(house)
            onChange({ ...value, houseId: house?.id ?? null })
          }}
        />
      </FilterPanelSection>

      <FilterPanelSection
        title={labels.tradePrefTitle}
        description={labels.tradePrefDescription}
      >
        <FilterToggleGroup
          options={tradePrefOptions}
          selected={value.tradePreferences}
          onChange={tradePreferences => onChange({ ...value, tradePreferences })}
          ariaLabel={labels.tradePrefAria}
        />
      </FilterPanelSection>

      <FilterPanelSection
        title={labels.bottleTitle}
        description={labels.bottleDescription}
      >
        <FilterToggleGroup
          options={bottleOptions}
          selected={value.bottleTypes}
          onChange={bottleTypes => onChange({ ...value, bottleTypes })}
          ariaLabel={labels.bottleAria}
        />
      </FilterPanelSection>

      <FilterPanelSection
        title={labels.conditionTitle}
        description={labels.conditionDescription}
      >
        <FilterToggleGroup
          options={conditionOptions}
          selected={value.conditions}
          onChange={conditions => onChange({ ...value, conditions })}
          ariaLabel={labels.conditionAria}
        />
      </FilterPanelSection>

      <FilterPanelSection
        title={labels.regionTitle}
        description={labels.regionDescription}
      >
        <Select
          selectId={regionSelectId}
          label={labels.regionLabel}
          selectData={regionSelectData}
          value={value.region ?? ""}
          action={e => {
            const raw = e.target.value
            onChange({
              ...value,
              region: raw ? (raw as ExchangeRegionBucket) : null,
            })
          }}
          size="compact"
          className="w-full max-w-none md:w-full"
        />
      </FilterPanelSection>

      <FilterPanelSection
        title={labels.minRepTitle}
        description={labels.minRepDescription}
      >
        <Select
          selectId={minRepSelectId}
          label={labels.minRepLabel}
          selectData={minRepSelectData}
          value={value.minRep != null ? String(value.minRep) : ""}
          action={e => {
            const raw = e.target.value
            onChange({
              ...value,
              minRep: raw ? (Number(raw) as DiscoveryMinRep) : null,
            })
          }}
          size="compact"
          className="w-full max-w-none md:w-full"
        />
      </FilterPanelSection>

      <FilterPanelSection
        title={labels.priceTitle}
        description={labels.priceDescription}
      >
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

      <FilterPanelSection
        title={labels.hasPhotosLabel}
        description={labels.hasPhotosDescription}
      >
        <CheckBox
          id="exchange-discovery-has-photos"
          label={labels.hasPhotosToggle}
          checked={value.hasPhotos}
          onChange={() => onChange({ ...value, hasPhotos: !value.hasPhotos })}
        />
      </FilterPanelSection>
    </div>
  )
}
