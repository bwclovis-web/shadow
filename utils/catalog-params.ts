import { HOUSES_PATH, THE_ARCHIVE_PATH } from "@/constants/routes"
import { SEASON_KEYS, type SeasonKey } from "@/types/perfume-season-vote"
import { DISCOVERY_QUERY, isValidDiscoveryId } from "@/utils/discovery-filters"

/** Divisible by 2, 3, and 4 so every grid breakpoint ends on a full row. */
export const CATALOG_PAGE_SIZE = 24

/** Upper bound on house/note ids accepted from the URL. */
export const CATALOG_MAX_SELECTIONS = 20

export const CATALOG_RESULTS_ID = "catalog-results"

export const CATALOG_VIEWS = ["grid", "list"] as const
export type CatalogView = (typeof CATALOG_VIEWS)[number]
export const DEFAULT_CATALOG_VIEW: CatalogView = "grid"

export const ARCHIVE_SORTS = [
  "created-desc",
  "created-asc",
  "name-asc",
  "name-desc",
] as const
export type ArchiveSort = (typeof ARCHIVE_SORTS)[number]

export const HOUSE_SORTS = [...ARCHIVE_SORTS, "type-asc"] as const
export type HouseSort = (typeof HOUSE_SORTS)[number]

export const DEFAULT_CATALOG_SORT = "created-desc" as const

/** Mirrors the Prisma `HouseType` enum; `getHouseCatalogPage` fails to type-check if they diverge. */
export const HOUSE_TYPES = [
  "niche",
  "designer",
  "indie",
  "celebrity",
  "drugstore",
] as const
export type HouseTypeKey = (typeof HOUSE_TYPES)[number]

export const CATALOG_QUERY = {
  house: DISCOVERY_QUERY.house,
  notes: DISCOVERY_QUERY.notes,
  season: DISCOVERY_QUERY.season,
  type: "type",
  sort: "sort",
  view: "view",
  page: "pg",
  letter: "letter",
  q: "q",
} as const

export type CatalogSearchParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

export type ArchiveFilters = {
  houseIds: string[]
  noteIds: string[]
  seasons: SeasonKey[]
}

export type ArchiveCatalogState = {
  letter: string | null
  filters: ArchiveFilters
  sort: ArchiveSort
  view: CatalogView
  page: number
}

export type HouseCatalogState = {
  letter: string | null
  houseTypes: HouseTypeKey[]
  sort: HouseSort
  view: CatalogView
  page: number
}

const readParam = (params: CatalogSearchParams, key: string): string => {
  if (params instanceof URLSearchParams) return params.get(key) ?? ""
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

const splitTokens = (raw: string): string[] =>
  raw
    .split(",")
    .map(token => token.trim())
    .filter(Boolean)

const pickAllowed = <T extends string>(
  raw: string,
  allowed: readonly T[]
): T[] => {
  const tokens = splitTokens(raw.toLowerCase())
  return allowed.filter(value => tokens.includes(value))
}

const pickIds = (raw: string): string[] =>
  [...new Set(splitTokens(raw).filter(isValidDiscoveryId))].slice(
    0,
    CATALOG_MAX_SELECTIONS
  )

const pickOne = <T extends string>(
  raw: string,
  allowed: readonly T[],
  fallback: T
): T => (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback

export const parseCatalogLetter = (raw: unknown): string | null =>
  typeof raw === "string" && /^[A-Za-z]$/.test(raw) ? raw.toUpperCase() : null

export const parseCatalogPage = (raw: string): number => {
  const page = Number.parseInt(raw, 10)
  return Number.isFinite(page) && page > 1 ? page : 1
}

export const emptyArchiveFilters = (): ArchiveFilters => ({
  houseIds: [],
  noteIds: [],
  seasons: [],
})

export const countArchiveFilters = (filters: ArchiveFilters): number =>
  filters.houseIds.length + filters.noteIds.length + filters.seasons.length

/** `letter` comes from the `/the-archive/[letter]` segment, not the query string. */
export const parseArchiveCatalogState = (
  params: CatalogSearchParams,
  letter: string | null
): ArchiveCatalogState => ({
  letter,
  filters: {
    houseIds: pickIds(readParam(params, CATALOG_QUERY.house)),
    noteIds: pickIds(readParam(params, CATALOG_QUERY.notes)),
    seasons: pickAllowed(readParam(params, CATALOG_QUERY.season), SEASON_KEYS),
  },
  sort: pickOne(readParam(params, CATALOG_QUERY.sort), ARCHIVE_SORTS, DEFAULT_CATALOG_SORT),
  view: pickOne(readParam(params, CATALOG_QUERY.view), CATALOG_VIEWS, DEFAULT_CATALOG_VIEW),
  page: parseCatalogPage(readParam(params, CATALOG_QUERY.page)),
})

export const parseHouseCatalogState = (
  params: CatalogSearchParams
): HouseCatalogState => ({
  letter: parseCatalogLetter(readParam(params, CATALOG_QUERY.letter)),
  houseTypes: pickAllowed(readParam(params, CATALOG_QUERY.type), HOUSE_TYPES),
  sort: pickOne(readParam(params, CATALOG_QUERY.sort), HOUSE_SORTS, DEFAULT_CATALOG_SORT),
  view: pickOne(readParam(params, CATALOG_QUERY.view), CATALOG_VIEWS, DEFAULT_CATALOG_VIEW),
  page: parseCatalogPage(readParam(params, CATALOG_QUERY.page)),
})

const setShared = (
  params: URLSearchParams,
  state: { sort: string; view: CatalogView; page: number }
) => {
  if (state.sort !== DEFAULT_CATALOG_SORT) params.set(CATALOG_QUERY.sort, state.sort)
  if (state.view !== DEFAULT_CATALOG_VIEW) params.set(CATALOG_QUERY.view, state.view)
  if (state.page > 1) params.set(CATALOG_QUERY.page, String(state.page))
}

const withQuery = (path: string, params: URLSearchParams): string => {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/** With `searchQuery`, only `q` and `view` apply: name search results are relevance-ranked, not filtered. */
export const buildArchiveCatalogHref = (
  state: ArchiveCatalogState,
  searchQuery?: string | null
): string => {
  const params = new URLSearchParams()
  if (searchQuery) {
    params.set(CATALOG_QUERY.q, searchQuery)
    if (state.view !== DEFAULT_CATALOG_VIEW) params.set(CATALOG_QUERY.view, state.view)
    return withQuery(THE_ARCHIVE_PATH, params)
  }
  const { houseIds, noteIds, seasons } = state.filters
  if (houseIds.length > 0) params.set(CATALOG_QUERY.house, houseIds.join(","))
  if (noteIds.length > 0) params.set(CATALOG_QUERY.notes, noteIds.join(","))
  if (seasons.length > 0) params.set(CATALOG_QUERY.season, seasons.join(","))
  setShared(params, state)
  const path = state.letter
    ? `${THE_ARCHIVE_PATH}/${state.letter.toLowerCase()}`
    : THE_ARCHIVE_PATH
  return withQuery(path, params)
}

export const buildHouseCatalogHref = (state: HouseCatalogState): string => {
  const params = new URLSearchParams()
  if (state.letter) params.set(CATALOG_QUERY.letter, state.letter.toLowerCase())
  if (state.houseTypes.length > 0) {
    params.set(CATALOG_QUERY.type, state.houseTypes.join(","))
  }
  setShared(params, state)
  return withQuery(HOUSES_PATH, params)
}
