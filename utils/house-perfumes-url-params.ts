import type { SortOption } from "@/utils/sortUtils"

export const HOUSE_PERFUME_NAME_SEARCH_MAX = 100

const PERFUME_LIST_SORT_SET = new Set<string>([
  "name-asc",
  "name-desc",
  "created-desc",
  "created-asc",
  "type-asc",
])

export const normalizeHousePerfumeNameSearch = (
  q: string | null | undefined
): string | undefined => {
  const t = (q ?? "").trim()
  if (!t) return undefined
  return t.slice(0, HOUSE_PERFUME_NAME_SEARCH_MAX)
}

export const parseHousePerfumeSortByParam = (
  value: string | null | undefined
): SortOption | undefined => {
  if (value === null || value === undefined || value === "") return undefined
  return PERFUME_LIST_SORT_SET.has(value) ? (value as SortOption) : undefined
}

/** Matches default omit-from-URL behavior on house detail (`created-desc`). */
export const DEFAULT_HOUSE_DETAIL_SORT: SortOption = "created-desc"

/**
 * Single-house listing: `type-asc` sorts by `PerfumeHouse.type`, which is identical
 * for every row — treat like default sort.
 */
export const parseHouseDetailSortOption = (
  sortParam: string | null | undefined
): SortOption => {
  const p = parseHousePerfumeSortByParam(sortParam)
  if (!p || p === "type-asc") return DEFAULT_HOUSE_DETAIL_SORT
  return p
}

/** For `getPerfumeHouseBySlug` / API: `null` uses server default order. */
export const houseDetailSortForApi = (
  sortParam: string | null | undefined
): string | null => {
  const canonical = parseHouseDetailSortOption(sortParam)
  return canonical === DEFAULT_HOUSE_DETAIL_SORT ? null : canonical
}
