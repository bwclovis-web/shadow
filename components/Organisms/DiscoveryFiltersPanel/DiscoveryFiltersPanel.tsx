"use client"

import { useEffect, useId, useMemo, useState, type FC, type ReactNode } from "react"
import {
  LuArrowLeftRight,
  LuFlower2,
  LuHouse,
  LuImage,
  LuMapPin,
  LuShield,
  LuSparkles,
  LuStar,
  LuTag,
} from "react-icons/lu"

import CheckBox from "@/components/Atoms/CheckBox/CheckBox"
import { ExchangeBottleMark } from "@/components/Atoms/ExchangeBottleMark"
import Input from "@/components/Atoms/Input/Input"
import Select from "@/components/Atoms/Select/Select"
import { SeasonSelectionToggleRow } from "@/components/Containers/Perfume/PerfumeSeasonVote/SeasonSelectionToggleRow"
import { FilterChipStrip } from "@/components/Molecules/FilterChipStrip"
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
  houseDescription?: string
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
  /** Drawer: "{count} selected" within a section badge. */
  sectionSelectedCount?: (count: number) => string
  /** Drawer: season / trade / etc. empty summaries. */
  summaryAny?: string
  summaryAnyRegion?: string
  summaryAnyReputation?: string
  summaryNoPriceLimit?: string
  activeFiltersAria?: string
  removeFilterAria?: (label: string) => string
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
  /**
   * `drawer` — Exchange filter mockup (collapsible groups, plain inputs,
   * single chip strip). Default keeps the older stacked panel for reuse.
   */
  layout?: "default" | "drawer"
  /** Season labels for collapsed summaries (drawer). */
  seasonLabel?: (key: "winter" | "spring" | "summer" | "fall") => string
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

const joinSummary = (parts: string[], fallback: string): string =>
  parts.length > 0 ? parts.join(", ") : fallback

export const DiscoveryFiltersPanel: FC<DiscoveryFiltersPanelProps> = ({
  value,
  onChange,
  initialNoteTags,
  initialHouse,
  labels,
  className,
  layout = "default",
  seasonLabel,
}) => {
  const regionSelectId = useId()
  const minRepSelectId = useId()
  const drawer = layout === "drawer"
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

  const houseSelected = useMemo((): HouseAutocompleteOption | null => {
    if (localHouse) return localHouse
    if (initialHouse && initialHouse.id === value.houseId) return initialHouse
    if (value.houseId) return { id: value.houseId, name: value.houseId }
    return null
  }, [localHouse, initialHouse, value.houseId])

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

  const tradePrefLabel = (pref: DiscoveryTradePreference): string =>
    pref === "cash"
      ? labels.tradePrefCash
      : pref === "trade"
        ? labels.tradePrefTrade
        : labels.tradePrefBoth

  const bottleLabel = (bottle: ExchangeBottleType): string =>
    bottle === "full"
      ? labels.bottleFull
      : bottle === "partial"
        ? labels.bottlePartial
        : bottle === "sample"
          ? labels.bottleSample
          : labels.bottleDecant

  const tradePrefOptions = TRADE_PREF_OPTIONS.map(pref => ({
    value: pref,
    label: tradePrefLabel(pref),
  }))

  const bottleOptions = BOTTLE_OPTIONS.map(bottle => ({
    value: bottle,
    label: bottleLabel(bottle),
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

  const anySummary = labels.summaryAny ?? "Any"
  const sectionSelected =
    labels.sectionSelectedCount ?? ((count: number) => `${count} selected`)

  const draftChips = useMemo(() => {
    if (!drawer) return []
    const removeAria =
      labels.removeFilterAria ?? ((label: string) => `Remove filter: ${label}`)
    const chips = draftNoteTags.map(tag => ({
      id: `draft-note-${tag.id}`,
      label: tag.name,
      removeAriaLabel: removeAria(tag.name),
      onRemove: () => {
        const nextTags = draftNoteTags.filter(t => t.id !== tag.id)
        setDraftNoteTags(nextTags)
        onChange({ ...value, noteIds: nextTags.map(t => t.id) })
      },
    }))
    if (houseSelected) {
      chips.push({
        id: `draft-house-${houseSelected.id}`,
        label: houseSelected.name,
        removeAriaLabel: removeAria(houseSelected.name),
        onRemove: () => {
          setLocalHouse(null)
          onChange({ ...value, houseId: null })
        },
      })
    }
    return chips
  }, [
    drawer,
    draftNoteTags,
    houseSelected,
    labels.removeFilterAria,
    onChange,
    value,
  ])

  const priceSummary = (() => {
    if (value.minPrice != null && value.maxPrice != null) {
      return `${value.minPrice}–${value.maxPrice}`
    }
    if (value.minPrice != null) return `${labels.minLabel} ${value.minPrice}`
    if (value.maxPrice != null) return `${labels.maxLabel} ${value.maxPrice}`
    return labels.summaryNoPriceLimit ?? "No limit"
  })()

  const section = (
    props: {
      title: string
      description?: string
      icon?: ReactNode
      summary?: string
      badge?: string
      defaultOpen?: boolean
      collapsible?: boolean
      trailing?: ReactNode
      children?: ReactNode
    }
  ) => (
    <FilterPanelSection
      tone={drawer ? "drawer" : "default"}
      collapsible={props.collapsible ?? drawer}
      defaultOpen={props.defaultOpen ?? !drawer}
      title={props.title}
      description={props.description}
      icon={drawer ? props.icon : undefined}
      summary={drawer ? props.summary : undefined}
      badge={drawer ? props.badge : undefined}
      trailing={props.trailing}
    >
      {props.children}
    </FilterPanelSection>
  )

  const priceInputs = (
    <div className="grid grid-cols-2 gap-3">
      <Input
        inputId="exchange-discovery-min-price"
        inputType="number"
        shading={false}
        label={labels.minLabel}
        min={0}
        step="any"
        value={minStr}
        onChange={e => setMinStr(e.target.value)}
        onBlur={commitPrice}
        className="!border !border-solid !border-noir-gold bg-noir-black/90 !text-base text-noir-gold-100 focus:!border-noir-gold-500 focus:ring-noir-gold"
      />
      <Input
        inputId="exchange-discovery-max-price"
        inputType="number"
        shading={false}
        label={labels.maxLabel}
        min={0}
        step="any"
        value={maxStr}
        onChange={e => setMaxStr(e.target.value)}
        onBlur={commitPrice}
        className="!border !border-solid !border-noir-gold bg-noir-black/90 !text-base text-noir-gold-100 focus:!border-noir-gold-500 focus:ring-noir-gold"
      />
    </div>
  )

  return (
    <div
      className={styleMerge(
        drawer
          ? "space-y-1"
          : "space-y-6 rounded-md border border-noir-gold bg-noir-dark p-4",
        className
      )}
    >
      {drawer && draftChips.length > 0 ? (
        <FilterChipStrip
          chips={draftChips}
          regionAriaLabel={labels.activeFiltersAria ?? "Selected filters"}
          className="mb-4"
        />
      ) : null}

      {section({
        title: labels.notesTitle,
        description: labels.notesDescription,
        icon: <LuFlower2 aria-hidden />,
        defaultOpen: true,
        badge:
          value.noteIds.length > 0
            ? sectionSelected(value.noteIds.length)
            : undefined,
        children: (
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
            surface={drawer ? "plain" : "dark"}
            selectedLayout={drawer ? "none" : "flow"}
            messages={noteSearchMessages}
            onChange={tags => {
              setDraftNoteTags(tags)
              onChange({ ...value, noteIds: tags.map(t => t.id) })
            }}
          />
        ),
      })}

      {section({
        title: labels.houseTitle,
        description: drawer ? labels.houseDescription : undefined,
        icon: <LuHouse aria-hidden />,
        defaultOpen: true,
        badge: houseSelected ? sectionSelected(1) : undefined,
        children: (
          <HouseAutocomplete
            inputId="exchange-discovery-house"
            label={labels.houseSearchLabel}
            clearLabel={labels.houseClear}
            selected={drawer ? null : houseSelected}
            messages={houseSearchMessages}
            onSelect={house => {
              setLocalHouse(house)
              onChange({ ...value, houseId: house?.id ?? null })
            }}
          />
        ),
      })}

      {section({
        title: labels.seasonTitle,
        description: drawer ? undefined : labels.seasonDescription,
        icon: <LuSparkles aria-hidden />,
        defaultOpen: drawer,
        summary: joinSummary(
          value.seasons.map(s => seasonLabel?.(s) ?? s),
          anySummary
        ),
        children: (
          <SeasonSelectionToggleRow
            selection={seasonsArrayToSelection(value.seasons)}
            compact={drawer}
            showAllSeasons={!drawer}
            onChange={sel =>
              onChange({
                ...value,
                seasons: selectionToSeasonsArray(sel),
              })
            }
          />
        ),
      })}

      {section({
        title: labels.tradePrefTitle,
        description: drawer ? undefined : labels.tradePrefDescription,
        icon: <LuArrowLeftRight aria-hidden />,
        defaultOpen: false,
        summary: joinSummary(
          value.tradePreferences.map(tradePrefLabel),
          anySummary
        ),
        children: (
          <FilterToggleGroup
            options={tradePrefOptions}
            selected={value.tradePreferences}
            onChange={tradePreferences =>
              onChange({ ...value, tradePreferences })
            }
            ariaLabel={labels.tradePrefAria}
          />
        ),
      })}

      {section({
        title: labels.bottleTitle,
        description: drawer ? undefined : labels.bottleDescription,
        icon: <ExchangeBottleMark className="h-4 w-3" />,
        defaultOpen: false,
        summary: joinSummary(value.bottleTypes.map(bottleLabel), anySummary),
        children: (
          <FilterToggleGroup
            options={bottleOptions}
            selected={value.bottleTypes}
            onChange={bottleTypes => onChange({ ...value, bottleTypes })}
            ariaLabel={labels.bottleAria}
          />
        ),
      })}

      {section({
        title: labels.conditionTitle,
        description: drawer ? undefined : labels.conditionDescription,
        icon: <LuShield aria-hidden />,
        defaultOpen: false,
        summary: joinSummary(
          value.conditions.map(c => labels.conditionLabels[c]),
          anySummary
        ),
        children: (
          <FilterToggleGroup
            options={conditionOptions}
            selected={value.conditions}
            onChange={conditions => onChange({ ...value, conditions })}
            ariaLabel={labels.conditionAria}
          />
        ),
      })}

      {section({
        title: labels.regionTitle,
        description: drawer ? undefined : labels.regionDescription,
        icon: <LuMapPin aria-hidden />,
        defaultOpen: false,
        summary: value.region
          ? regionLabelFor(value.region)
          : (labels.summaryAnyRegion ?? labels.regionAll),
        children: (
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
        ),
      })}

      {section({
        title: labels.minRepTitle,
        description: drawer ? undefined : labels.minRepDescription,
        icon: <LuStar aria-hidden />,
        defaultOpen: false,
        summary:
          value.minRep != null
            ? `${value.minRep}+`
            : (labels.summaryAnyReputation ?? labels.minRepAll),
        children: (
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
        ),
      })}

      {section({
        title: labels.priceTitle,
        description: drawer ? undefined : labels.priceDescription,
        icon: <LuTag aria-hidden />,
        defaultOpen: false,
        summary: priceSummary,
        children: priceInputs,
      })}

      {drawer ? (
        <FilterPanelSection
          tone="drawer"
          collapsible={false}
          title={labels.hasPhotosLabel}
          description={labels.hasPhotosDescription}
          icon={<LuImage aria-hidden />}
          trailing={
            <CheckBox
              id="exchange-discovery-has-photos"
              label={
                <span className="sr-only">{labels.hasPhotosToggle}</span>
              }
              checked={value.hasPhotos}
              onChange={() =>
                onChange({ ...value, hasPhotos: !value.hasPhotos })
              }
            />
          }
        />
      ) : (
        section({
          title: labels.hasPhotosLabel,
          description: labels.hasPhotosDescription,
          children: (
            <CheckBox
              id="exchange-discovery-has-photos"
              label={labels.hasPhotosToggle}
              checked={value.hasPhotos}
              onChange={() =>
                onChange({ ...value, hasPhotos: !value.hasPhotos })
              }
            />
          ),
        })
      )}
    </div>
  )
}
