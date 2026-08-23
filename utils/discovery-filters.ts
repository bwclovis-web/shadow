import { SEASON_KEYS, type SeasonKey } from "@/types/perfume-season-vote"

/** URL query keys for exchange / discovery filters (CF-010). */
export const DISCOVERY_QUERY = {
  notes: "notes",
  season: "season",
  house: "house",
  perfume: "perfume",
  minPrice: "minPrice",
  maxPrice: "maxPrice",
  tradePref: "tradePref",
  bottle: "bottle",
  condition: "condition",
  region: "region",
  hasPhotos: "hasPhotos",
  minRep: "minRep",
} as const

export const DISCOVERY_MIN_REP_OPTIONS = [50, 70, 80] as const
export type DiscoveryMinRep = (typeof DISCOVERY_MIN_REP_OPTIONS)[number]

export const DISCOVERY_TRADE_PREFERENCES = ["cash", "trade", "both"] as const
export type DiscoveryTradePreference = (typeof DISCOVERY_TRADE_PREFERENCES)[number]

export const EXCHANGE_BOTTLE_TYPES = ["full", "partial", "sample", "decant"] as const
export type ExchangeBottleType = (typeof EXCHANGE_BOTTLE_TYPES)[number]

export const DISCOVERY_LISTING_CONDITIONS = [
  "sealed",
  "mint",
  "lightlyUsed",
  "heavilyUsed",
  "damaged",
] as const
export type DiscoveryListingCondition = (typeof DISCOVERY_LISTING_CONDITIONS)[number]

export const EXCHANGE_REGION_BUCKETS = ["US", "UK", "AU", "EU", "other"] as const
export type ExchangeRegionBucket = (typeof EXCHANGE_REGION_BUCKETS)[number]

export type PerfumeDiscoveryFilters = {
  noteIds: string[]
  seasons: SeasonKey[]
  houseId: string | null
  perfumeId: string | null
  minPrice: number | null
  maxPrice: number | null
  tradePreferences: DiscoveryTradePreference[]
  bottleTypes: ExchangeBottleType[]
  conditions: DiscoveryListingCondition[]
  region: ExchangeRegionBucket | null
  hasPhotos: boolean
  minRep: DiscoveryMinRep | null
}

export const emptyDiscoveryFilters = (): PerfumeDiscoveryFilters => ({
  noteIds: [],
  seasons: [],
  houseId: null,
  perfumeId: null,
  minPrice: null,
  maxPrice: null,
  tradePreferences: [],
  bottleTypes: [],
  conditions: [],
  region: null,
  hasPhotos: false,
  minRep: null,
})

/** CUID / Prisma id: alphanumeric, typical length 20–32. */
export const isValidDiscoveryId = (raw: string): boolean => {
  const s = raw.trim()
  return /^[a-z0-9]{20,32}$/i.test(s)
}

const parseCommaTokens = (raw: string): string[] =>
  raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)

const parseTradePreferenceToken = (t: string): DiscoveryTradePreference | null => {
  const k = t.trim().toLowerCase()
  return (DISCOVERY_TRADE_PREFERENCES as readonly string[]).includes(k)
    ? (k as DiscoveryTradePreference)
    : null
}

const parseBottleTypeToken = (t: string): ExchangeBottleType | null => {
  const k = t.trim().toLowerCase()
  return (EXCHANGE_BOTTLE_TYPES as readonly string[]).includes(k)
    ? (k as ExchangeBottleType)
    : null
}

const parseConditionToken = (t: string): DiscoveryListingCondition | null => {
  const k = t.trim()
  return (DISCOVERY_LISTING_CONDITIONS as readonly string[]).includes(k)
    ? (k as DiscoveryListingCondition)
    : null
}

export const isExchangeRegionBucket = (raw: string): raw is ExchangeRegionBucket => {
  const upper = raw.trim().toUpperCase()
  if (upper === "OTHER") return true
  return (EXCHANGE_REGION_BUCKETS as readonly string[]).includes(
    upper as ExchangeRegionBucket
  )
}

const parseRegionToken = (raw: string): ExchangeRegionBucket | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase() === "other") return "other"
  const upper = trimmed.toUpperCase()
  return (EXCHANGE_REGION_BUCKETS as readonly string[]).includes(
    upper as ExchangeRegionBucket
  )
    ? (upper as ExchangeRegionBucket)
    : null
}

const parseHasPhotosFlag = (raw: string): boolean => {
  const v = raw.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

/**
 * Parse a listing price string (e.g. "$49.99", "50") to a number, or null if unusable.
 */
export const parseListingPriceToNumber = (
  raw: string | null | undefined
): number | null => {
  if (raw == null) return null
  const cleaned = raw.replace(/[^0-9.]/g, "").trim()
  if (!cleaned) return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function parseSeasonToken(t: string): SeasonKey | null {
  const k = t.trim().toLowerCase()
  return (SEASON_KEYS as readonly string[]).includes(k) ? (k as SeasonKey) : null
}

function parseOptionalNonNegativeNumber(raw: string): number | null {
  if (!raw.trim()) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Read discovery filters from URL search params (client `URLSearchParams` or App Router `searchParams`).
 */
export const parseDiscoveryFiltersFromSearchParams = (
  params: URLSearchParams | Record<string, string | string[] | undefined>
): PerfumeDiscoveryFilters => {
  const get = (key: string): string => {
    if (params instanceof URLSearchParams) {
      return params.get(key) ?? ""
    }
    const v = params[key]
    if (Array.isArray(v)) return (v[0] ?? "").toString()
    return (v ?? "").toString()
  }

  const noteIds = get(DISCOVERY_QUERY.notes)
    .split(",")
    .map(s => s.trim())
    .filter(isValidDiscoveryId)

  const seasonsRaw = get(DISCOVERY_QUERY.season)
    .split(",")
    .map(parseSeasonToken)
    .filter((x): x is SeasonKey => x != null)
  const seasons = [...new Set(seasonsRaw)]

  const houseRaw = get(DISCOVERY_QUERY.house).trim()
  const houseId = isValidDiscoveryId(houseRaw) ? houseRaw : null

  const perfumeRaw = get(DISCOVERY_QUERY.perfume).trim()
  const perfumeId = isValidDiscoveryId(perfumeRaw) ? perfumeRaw : null

  let minPrice = parseOptionalNonNegativeNumber(get(DISCOVERY_QUERY.minPrice))
  let maxPrice = parseOptionalNonNegativeNumber(get(DISCOVERY_QUERY.maxPrice))

  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    ;[minPrice, maxPrice] = [maxPrice, minPrice]
  }

  const tradePreferences = [
    ...new Set(
      parseCommaTokens(get(DISCOVERY_QUERY.tradePref))
        .map(parseTradePreferenceToken)
        .filter((x): x is DiscoveryTradePreference => x != null)
    ),
  ]

  const bottleTypes = [
    ...new Set(
      parseCommaTokens(get(DISCOVERY_QUERY.bottle))
        .map(parseBottleTypeToken)
        .filter((x): x is ExchangeBottleType => x != null)
    ),
  ]

  const conditions = [
    ...new Set(
      parseCommaTokens(get(DISCOVERY_QUERY.condition))
        .map(parseConditionToken)
        .filter((x): x is DiscoveryListingCondition => x != null)
    ),
  ]

  const region = parseRegionToken(get(DISCOVERY_QUERY.region))
  const hasPhotos = parseHasPhotosFlag(get(DISCOVERY_QUERY.hasPhotos))
  const minRepRaw = parseOptionalNonNegativeNumber(get(DISCOVERY_QUERY.minRep))
  const minRep =
    minRepRaw != null &&
    (DISCOVERY_MIN_REP_OPTIONS as readonly number[]).includes(minRepRaw)
      ? (minRepRaw as DiscoveryMinRep)
      : null

  return {
    noteIds,
    seasons,
    houseId,
    perfumeId,
    minPrice,
    maxPrice,
    tradePreferences,
    bottleTypes,
    conditions,
    region,
    hasPhotos,
    minRep,
  }
}

/**
 * Merge discovery params into URLSearchParams. Preserves unrelated keys (e.g. `q`, `pg`).
 * Caller should delete `pg` when filter semantics require resetting the page.
 */
export const discoveryFiltersToSearchParams = (
  filters: PerfumeDiscoveryFilters,
  base?: URLSearchParams
): URLSearchParams => {
  const out = base ? new URLSearchParams(base.toString()) : new URLSearchParams()

  const keysToClear = Object.values(DISCOVERY_QUERY)
  for (const key of keysToClear) {
    out.delete(key)
  }

  if (filters.noteIds.length > 0) {
    out.set(DISCOVERY_QUERY.notes, filters.noteIds.join(","))
  }
  if (filters.seasons.length > 0) {
    out.set(DISCOVERY_QUERY.season, filters.seasons.join(","))
  }
  if (filters.houseId) {
    out.set(DISCOVERY_QUERY.house, filters.houseId)
  }
  if (filters.perfumeId) {
    out.set(DISCOVERY_QUERY.perfume, filters.perfumeId)
  }
  if (filters.minPrice != null) {
    out.set(DISCOVERY_QUERY.minPrice, String(filters.minPrice))
  }
  if (filters.maxPrice != null) {
    out.set(DISCOVERY_QUERY.maxPrice, String(filters.maxPrice))
  }
  if (filters.tradePreferences.length > 0) {
    out.set(DISCOVERY_QUERY.tradePref, filters.tradePreferences.join(","))
  }
  if (filters.bottleTypes.length > 0) {
    out.set(DISCOVERY_QUERY.bottle, filters.bottleTypes.join(","))
  }
  if (filters.conditions.length > 0) {
    out.set(DISCOVERY_QUERY.condition, filters.conditions.join(","))
  }
  if (filters.region) {
    out.set(DISCOVERY_QUERY.region, filters.region)
  }
  if (filters.hasPhotos) {
    out.set(DISCOVERY_QUERY.hasPhotos, "1")
  }
  if (filters.minRep != null) {
    out.set(DISCOVERY_QUERY.minRep, String(filters.minRep))
  }

  return out
}

export const discoveryFiltersActive = (filters: PerfumeDiscoveryFilters): boolean =>
  filters.noteIds.length > 0 ||
  filters.seasons.length > 0 ||
  filters.houseId != null ||
  filters.perfumeId != null ||
  filters.minPrice != null ||
  filters.maxPrice != null ||
  filters.tradePreferences.length > 0 ||
  filters.bottleTypes.length > 0 ||
  filters.conditions.length > 0 ||
  filters.region != null ||
  filters.hasPhotos ||
  filters.minRep != null

export const removeDiscoveryNoteId = (
  filters: PerfumeDiscoveryFilters,
  noteId: string
): PerfumeDiscoveryFilters => ({
  ...filters,
  noteIds: filters.noteIds.filter(id => id !== noteId),
})

export const removeDiscoverySeason = (
  filters: PerfumeDiscoveryFilters,
  season: SeasonKey
): PerfumeDiscoveryFilters => ({
  ...filters,
  seasons: filters.seasons.filter(s => s !== season),
})

export const clearDiscoveryHouse = (
  filters: PerfumeDiscoveryFilters
): PerfumeDiscoveryFilters => ({ ...filters, houseId: null })

export const clearDiscoveryPerfume = (
  filters: PerfumeDiscoveryFilters
): PerfumeDiscoveryFilters => ({ ...filters, perfumeId: null })

export const clearDiscoveryPrice = (
  filters: PerfumeDiscoveryFilters
): PerfumeDiscoveryFilters => ({ ...filters, minPrice: null, maxPrice: null })

export const removeDiscoveryTradePreference = (
  filters: PerfumeDiscoveryFilters,
  pref: DiscoveryTradePreference
): PerfumeDiscoveryFilters => ({
  ...filters,
  tradePreferences: filters.tradePreferences.filter(p => p !== pref),
})

export const removeDiscoveryBottleType = (
  filters: PerfumeDiscoveryFilters,
  bottle: ExchangeBottleType
): PerfumeDiscoveryFilters => ({
  ...filters,
  bottleTypes: filters.bottleTypes.filter(b => b !== bottle),
})

export const removeDiscoveryCondition = (
  filters: PerfumeDiscoveryFilters,
  condition: DiscoveryListingCondition
): PerfumeDiscoveryFilters => ({
  ...filters,
  conditions: filters.conditions.filter(c => c !== condition),
})

export const clearDiscoveryRegion = (
  filters: PerfumeDiscoveryFilters
): PerfumeDiscoveryFilters => ({ ...filters, region: null })

export const clearDiscoveryHasPhotos = (
  filters: PerfumeDiscoveryFilters
): PerfumeDiscoveryFilters => ({ ...filters, hasPhotos: false })

export const clearDiscoveryMinRep = (
  filters: PerfumeDiscoveryFilters
): PerfumeDiscoveryFilters => ({ ...filters, minRep: null })

/** Map URL season multi-select to `SeasonSelection` for `SeasonSelectionToggleRow`. */
export const seasonsArrayToSelection = (seasons: SeasonKey[]) => {
  const s: Record<SeasonKey, boolean> = {
    winter: false,
    spring: false,
    summer: false,
    fall: false,
  }
  for (const k of seasons) {
    s[k] = true
  }
  return s
}

export const selectionToSeasonsArray = (sel: Record<SeasonKey, boolean>): SeasonKey[] =>
  SEASON_KEYS.filter(k => sel[k])
