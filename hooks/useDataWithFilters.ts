"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { type SortOption } from "~/utils/sortUtils"

const URL_KEYS = {
  sort: "sort",
  search: "q",
} as const

const getTimeValue = (value: Date | string): number => {
  if (value instanceof Date) return value.getTime()
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const isValidSortOption = (value: string): value is SortOption =>
  ["name-asc", "name-desc", "created-desc", "created-asc", "type-asc"].includes(value)

type CustomFilterConfig<T> = {
  predicate: (item: T, value: string) => boolean
}

interface UseDataWithFiltersOptions<T> {
  items: T[]
  nameAccessor?: (item: T) => string
  dateAccessor?: (item: T) => Date | string
  defaultSort?: SortOption
  defaultType?: string
  customFilters?: Record<string, CustomFilterConfig<T>>
  syncToUrl?: boolean
}

interface UseDataWithFiltersReturn<T> {
  data: T[]
  filteredData: T[]
  selectedSort: SortOption
  selectedType: string
  selectedLetter: string | null
  searchQuery: string
  customFilterValues: Record<string, string>
  setSelectedSort: (sort: SortOption) => void
  setSelectedType: (type: string) => void
  setSelectedLetter: (letter: string | null) => void
  setSearchQuery: (query: string) => void
  setCustomFilterValue: (key: string, value: string) => void
  resetFilters: () => void
}

const buildSortComparator = <T>(
  sortBy: SortOption,
  getName: (item: T) => string,
  getDate: (item: T) => Date | string,
): ((a: T, b: T) => number) => {
  switch (sortBy) {
    case "name-asc":
      return (a, b) => getName(a).localeCompare(getName(b))
    case "name-desc":
      return (a, b) => getName(b).localeCompare(getName(a))
    case "created-asc":
      return (a, b) => getTimeValue(getDate(a)) - getTimeValue(getDate(b))
    case "created-desc":
      return (a, b) => getTimeValue(getDate(b)) - getTimeValue(getDate(a))
    case "type-asc":
      return (a, b) =>
        ((a as Record<string, unknown>).type as string ?? "").localeCompare(
          (b as Record<string, unknown>).type as string ?? "",
        )
    default:
      return (a, b) => getTimeValue(getDate(b)) - getTimeValue(getDate(a))
  }
}

export const useDataWithFilters = <T extends { id: string }>({
  items,
  nameAccessor,
  dateAccessor,
  defaultSort = "created-desc",
  defaultType = "all",
  customFilters,
  syncToUrl = false,
}: UseDataWithFiltersOptions<T>): UseDataWithFiltersReturn<T> => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getName = useCallback(
    (item: T) =>
      nameAccessor
        ? nameAccessor(item)
        : (item as unknown as Record<string, string>).name ?? "",
    [nameAccessor],
  )

  const getDate = useCallback(
    (item: T) =>
      dateAccessor
        ? dateAccessor(item)
        : (item as unknown as Record<string, Date | string>).createdAt ?? "",
    [dateAccessor],
  )

  const readUrlParam = useCallback(
    (key: string, fallback: string): string => {
      if (!syncToUrl) return fallback
      return searchParams.get(key) ?? fallback
    },
    [syncToUrl, searchParams],
  )

  const initialSortFromUrl = readUrlParam(URL_KEYS.sort, defaultSort)
  const initialSearchFromUrl = readUrlParam(URL_KEYS.search, "")

  const initialCustomFromUrl = useMemo(() => {
    const values: Record<string, string> = {}
    if (customFilters) {
      for (const key of Object.keys(customFilters)) {
        values[key] = readUrlParam(key, "")
      }
    }
    return values
  }, [customFilters, readUrlParam])

  const [selectedSort, setSelectedSortState] = useState<SortOption>(
    isValidSortOption(initialSortFromUrl) ? initialSortFromUrl : defaultSort,
  )
  const [selectedType, setSelectedType] = useState<string>(defaultType)
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [searchQuery, setSearchQueryState] = useState<string>(initialSearchFromUrl)
  const [customFilterValues, setCustomFilterValuesState] =
    useState<Record<string, string>>(initialCustomFromUrl)

  const pendingUrlUpdate = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushUrlParams = useCallback(
    (overrides: Record<string, string>) => {
      if (!syncToUrl) return

      if (pendingUrlUpdate.current) clearTimeout(pendingUrlUpdate.current)

      pendingUrlUpdate.current = setTimeout(() => {
        const next = new URLSearchParams(searchParams.toString())

        next.delete("pg")

        for (const [key, value] of Object.entries(overrides)) {
          if (!value || (value === defaultSort && key === URL_KEYS.sort)) {
            next.delete(key)
          } else {
            next.set(key, value)
          }
        }

        const qs = next.toString()
        const path = window.location.pathname
        router.replace(`${path}${qs ? `?${qs}` : ""}`, { scroll: false })
      }, 0)
    },
    [syncToUrl, router, searchParams, defaultSort],
  )

  const setSelectedSort = useCallback(
    (sort: SortOption) => {
      setSelectedSortState(sort)
      pushUrlParams({ [URL_KEYS.sort]: sort })
    },
    [pushUrlParams],
  )

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryState(query)
      pushUrlParams({ [URL_KEYS.search]: query })
    },
    [pushUrlParams],
  )

  const setCustomFilterValue = useCallback(
    (key: string, value: string) => {
      setCustomFilterValuesState((prev) => ({ ...prev, [key]: value }))
      pushUrlParams({ [key]: value })
    },
    [pushUrlParams],
  )

  const filteredData = useMemo(() => {
    let filtered = [...items]

    if (selectedType && selectedType !== "all") {
      filtered = filtered.filter(
        (item) => (item as unknown as Record<string, string>).type === selectedType,
      )
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((item) => getName(item).toLowerCase().includes(q))
    }

    if (customFilters) {
      for (const [key, config] of Object.entries(customFilters)) {
        const value = customFilterValues[key] ?? ""
        if (value && value !== "all") {
          filtered = filtered.filter((item) => config.predicate(item, value))
        }
      }
    }

    const comparator = buildSortComparator(selectedSort, getName, getDate)
    filtered.sort(comparator)

    return filtered
  }, [items, selectedSort, selectedType, searchQuery, getName, getDate, customFilters, customFilterValues])

  const resetFilters = useCallback(() => {
    setSelectedSortState(defaultSort)
    setSelectedType(defaultType)
    setSelectedLetter(null)
    setSearchQueryState("")

    const resetCustom: Record<string, string> = {}
    if (customFilters) {
      for (const key of Object.keys(customFilters)) {
        resetCustom[key] = ""
      }
    }
    setCustomFilterValuesState(resetCustom)

    if (syncToUrl) {
      const path = window.location.pathname
      router.replace(path, { scroll: false })
    }
  }, [defaultSort, defaultType, customFilters, syncToUrl, router])

  return {
    data: items,
    filteredData,
    selectedSort,
    selectedType,
    selectedLetter,
    searchQuery,
    customFilterValues,
    setSelectedSort,
    setSelectedType,
    setSelectedLetter,
    setSearchQuery,
    setCustomFilterValue,
    resetFilters,
  }
}
