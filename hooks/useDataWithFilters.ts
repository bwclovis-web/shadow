import { useCallback, useMemo, useState } from "react"

import {
  filterBySearchQuery,
  filterByType,
  sortItems,
  type SortOption,
} from "~/utils/sortUtils"

interface UseDataWithFiltersOptions<T> {
  initialData: T[]
  defaultSort?: SortOption
  defaultType?: string
}

interface UseDataWithFiltersReturn<T> {
  data: T[]
  filteredData: T[]
  selectedSort: SortOption
  selectedType: string
  selectedLetter: string | null
  searchQuery: string
  setSelectedSort: (sort: SortOption) => void
  setSelectedType: (type: string) => void
  setSelectedLetter: (letter: string | null) => void
  setSearchQuery: (query: string) => void
  resetFilters: () => void
}

export function useDataWithFilters<
  T extends { id: string; name: string; createdAt: Date | string; type?: string }
>({
  initialData,
  defaultSort = "created-desc",
  defaultType = "all",
}: UseDataWithFiltersOptions<T>): UseDataWithFiltersReturn<T> {
  const [selectedSort, setSelectedSort] = useState<SortOption>(defaultSort)
  const [selectedType, setSelectedType] = useState<string>(defaultType)
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>("")

  const filteredData = useMemo(() => {
    let filtered = [...initialData]

    // Apply type filter
    if (selectedType && selectedType !== "all") {
      filtered = filterByType(filtered, selectedType)
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filterBySearchQuery(filtered, searchQuery)
    }

    // Apply sorting
    filtered = sortItems(filtered, selectedSort)

    return filtered
  }, [
initialData, selectedSort, selectedType, searchQuery
])

  const resetFilters = useCallback(() => {
    setSelectedSort(defaultSort)
    setSelectedType(defaultType)
    setSelectedLetter(null)
    setSearchQuery("")
  }, [defaultSort, defaultType])

  return {
    data: initialData,
    filteredData,
    selectedSort,
    selectedType,
    selectedLetter,
    searchQuery,
    setSelectedSort,
    setSelectedType,
    setSelectedLetter,
    setSearchQuery,
    resetFilters,
  }
}
