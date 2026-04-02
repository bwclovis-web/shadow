import { SEASON_KEYS, type SeasonKey } from "@/types/perfume-season-vote"

/** URL query keys for exchange / discovery filters (CF-010). */
export const DISCOVERY_QUERY = {
  notes: "notes",
  season: "season",
  house: "house",
  minPrice: "minPrice",
  maxPrice: "maxPrice",
} as const

export type PerfumeDiscoveryFilters = {
  noteIds: string[]
  seasons: SeasonKey[]
  houseId: string | null
  minPrice: number | null
  maxPrice: number | null
}

export function emptyDiscoveryFilters(): PerfumeDiscoveryFilters {
  return {
    noteIds: [],
    seasons: [],
    houseId: null,
    minPrice: null,
    maxPrice: null,
  }
}

/** CUID / Prisma id: alphanumeric, typical length 20–32. */
export function isValidDiscoveryId(raw: string): boolean {
  const s = raw.trim()
  return /^[a-z0-9]{20,32}$/i.test(s)
}

/**
 * Parse a listing price string (e.g. "$49.99", "50") to a number, or null if unusable.
 */
export function parseListingPriceToNumber(raw: string | null | undefined): number | null {
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
export function parseDiscoveryFiltersFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): PerfumeDiscoveryFilters {
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

  let minPrice = parseOptionalNonNegativeNumber(get(DISCOVERY_QUERY.minPrice))
  let maxPrice = parseOptionalNonNegativeNumber(get(DISCOVERY_QUERY.maxPrice))

  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    ;[minPrice, maxPrice] = [maxPrice, minPrice]
  }

  return {
    noteIds,
    seasons,
    houseId,
    minPrice,
    maxPrice,
  }
}

/**
 * Merge discovery params into URLSearchParams. Preserves unrelated keys (e.g. `q`, `pg`).
 * Caller should delete `pg` when filter semantics require resetting the page.
 */
export function discoveryFiltersToSearchParams(
  filters: PerfumeDiscoveryFilters,
  base?: URLSearchParams
): URLSearchParams {
  const out = base ? new URLSearchParams(base.toString()) : new URLSearchParams()

  out.delete(DISCOVERY_QUERY.notes)
  out.delete(DISCOVERY_QUERY.season)
  out.delete(DISCOVERY_QUERY.house)
  out.delete(DISCOVERY_QUERY.minPrice)
  out.delete(DISCOVERY_QUERY.maxPrice)

  if (filters.noteIds.length > 0) {
    out.set(DISCOVERY_QUERY.notes, filters.noteIds.join(","))
  }
  if (filters.seasons.length > 0) {
    out.set(DISCOVERY_QUERY.season, filters.seasons.join(","))
  }
  if (filters.houseId) {
    out.set(DISCOVERY_QUERY.house, filters.houseId)
  }
  if (filters.minPrice != null) {
    out.set(DISCOVERY_QUERY.minPrice, String(filters.minPrice))
  }
  if (filters.maxPrice != null) {
    out.set(DISCOVERY_QUERY.maxPrice, String(filters.maxPrice))
  }

  return out
}

export function discoveryFiltersActive(filters: PerfumeDiscoveryFilters): boolean {
  return (
    filters.noteIds.length > 0 ||
    filters.seasons.length > 0 ||
    filters.houseId != null ||
    filters.minPrice != null ||
    filters.maxPrice != null
  )
}

export function removeDiscoveryNoteId(
  filters: PerfumeDiscoveryFilters,
  noteId: string
): PerfumeDiscoveryFilters {
  return {
    ...filters,
    noteIds: filters.noteIds.filter(id => id !== noteId),
  }
}

export function removeDiscoverySeason(
  filters: PerfumeDiscoveryFilters,
  season: SeasonKey
): PerfumeDiscoveryFilters {
  return {
    ...filters,
    seasons: filters.seasons.filter(s => s !== season),
  }
}

export function clearDiscoveryHouse(
  filters: PerfumeDiscoveryFilters
): PerfumeDiscoveryFilters {
  return { ...filters, houseId: null }
}

export function clearDiscoveryPrice(
  filters: PerfumeDiscoveryFilters
): PerfumeDiscoveryFilters {
  return { ...filters, minPrice: null, maxPrice: null }
}

/** Map URL season multi-select to `SeasonSelection` for `SeasonSelectionToggleRow`. */
export function seasonsArrayToSelection(seasons: SeasonKey[]) {
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

export function selectionToSeasonsArray(sel: Record<SeasonKey, boolean>): SeasonKey[] {
  return SEASON_KEYS.filter(k => sel[k])
}
