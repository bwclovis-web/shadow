/* eslint-disable max-len */

export type SortOption =
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc"
  | "type-asc"

export interface SortConfig {
  sortBy: SortOption
  sortByType?: boolean
}

export interface FilterConfig {
  type?: string
  searchQuery?: string
}

export interface SortableItem {
  id: string
  name: string
  createdAt: Date | string
  type?: string
}

const ORDER_BY_MAP: Record<SortOption, Record<string, "asc" | "desc">> = {
  "name-asc": { name: "asc" },
  "name-desc": { name: "desc" },
  "created-asc": { createdAt: "asc" },
  "created-desc": { createdAt: "desc" },
  "type-asc": { type: "asc" },
} as const

const SORT_OPTION_CONFIG: Array<{ id: SortOption; value: SortOption; labelKey: string; defaultChecked: boolean }> = [
  { id: "created-desc", value: "created-desc", labelKey: "sortOptions.created-desc", defaultChecked: true },
  { id: "created-asc", value: "created-asc", labelKey: "sortOptions.created-asc", defaultChecked: false },
  { id: "name-asc", value: "name-asc", labelKey: "sortOptions.name-asc", defaultChecked: false },
  { id: "name-desc", value: "name-desc", labelKey: "sortOptions.name-desc", defaultChecked: false },
  { id: "type-asc", value: "type-asc", labelKey: "sortOptions.type-asc", defaultChecked: false },
]

const ALPHABET_LETTERS = Object.freeze(
  Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
) as readonly string[]

const getTimeValue = (value: Date | string): number => {
  if (value instanceof Date) return value.getTime()
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export const buildOrderBy = (sortBy: SortOption, sortByType?: boolean) =>
  sortBy ? ORDER_BY_MAP[sortBy] ?? { createdAt: "desc" } : sortByType ? { type: "asc" } : { createdAt: "desc" }

export const filterByType = (items: SortableItem[], type: string) =>
  !type || type === "all" ? items : items.filter(item => item.type === type)

export const filterBySearchQuery = (items: SortableItem[], searchQuery: string) => {
  if (!searchQuery) return items
  const q = searchQuery.toLowerCase()
  return items.filter(item => item.name.toLowerCase().includes(q))
}

const SORT_COMPARATORS = {
  "name-asc": (a: SortableItem, b: SortableItem) => a.name.localeCompare(b.name),
  "name-desc": (a: SortableItem, b: SortableItem) => b.name.localeCompare(a.name),
  "created-asc": (a: SortableItem, b: SortableItem) => getTimeValue(a.createdAt) - getTimeValue(b.createdAt),
  "created-desc": (a: SortableItem, b: SortableItem) => getTimeValue(b.createdAt) - getTimeValue(a.createdAt),
  "type-asc": (a: SortableItem, b: SortableItem) => (a.type ?? "").localeCompare(b.type ?? ""),
} as const

export const sortItems = <T extends SortableItem>(items: T[], sortBy: SortOption): T[] =>
  [...items].sort(SORT_COMPARATORS[sortBy] ?? SORT_COMPARATORS["created-desc"])

export const groupByFirstLetter = <T extends SortableItem>(items: T[]) => {
  const grouped: Record<string, T[]> = {}
  for (const item of items) {
    const letter = item.name.charAt(0).toUpperCase()
    ;(grouped[letter] ??= []).push(item)
  }
  return Object.fromEntries(Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)))
}

export const getAlphabetLetters = () => [...ALPHABET_LETTERS]

export const getDefaultSortOptions = (t: (key: string) => string) =>
  SORT_OPTION_CONFIG.map(({ id, value, labelKey, defaultChecked }) => ({
    id,
    value,
    label: t(labelKey),
    name: "sortBy" as const,
    defaultChecked,
  }))
