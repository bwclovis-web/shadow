/**
 * Hook for paginated data fetching with common pagination patterns
 */

import { useCallback, useState } from "react"

import { useDataFetching, UseDataFetchingOptions } from "./useDataFetching"

export interface PaginationMeta {
  page: number
  pageSize: number
  totalPages: number
  totalCount: number
  hasMore: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface UsePaginatedDataOptions<T>
  extends Omit<UseDataFetchingOptions<PaginatedResponse<T>>, "url" | "deps"> {

  /**
   * Base URL for the API endpoint
   */
  baseUrl: string

  /**
   * Initial page number
   * @default 1
   */
  initialPage?: number

  /**
   * Number of items per page
   * @default 20
   */
  pageSize?: number

  /**
   * Query parameters to append to the URL
   */
  params?: Record<string, string | number | boolean | undefined>

  /**
   * Whether to accumulate data across pages (infinite scroll)
   * @default false
   */
  accumulate?: boolean
}

export interface UsePaginatedDataReturn<T> {

  /**
   * The paginated data
   */
  data: T[]

  /**
   * Pagination metadata
   */
  meta: PaginationMeta | null

  /**
   * Whether data is being fetched
   */
  isLoading: boolean

  /**
   * Whether this is the first page load
   */
  isInitialLoading: boolean

  /**
   * Whether next page is loading
   */
  isLoadingMore: boolean

  /**
   * Error object if fetch failed
   */
  error: Error | null

  /**
   * Whether an error occurred
   */
  isError: boolean

  /**
   * Current page number
   */
  currentPage: number

  /**
   * Go to specific page
   */
  goToPage: (page: number) => void

  /**
   * Go to next page
   */
  nextPage: () => void

  /**
   * Go to previous page
   */
  prevPage: () => void

  /**
   * Reload current page
   */
  refetch: () => Promise<void>

  /**
   * Reset to first page
   */
  reset: () => void

  /**
   * Clear error state
   */
  clearError: () => void
}

/**
 * Hook for fetching paginated data
 *
 * @example Basic pagination
 * ```tsx
 * const { data, meta, nextPage, prevPage } = usePaginatedData<Perfume>({
 *   baseUrl: '/api/perfumes',
 *   pageSize: 20
 * })
 * ```
 *
 * @example With filters
 * ```tsx
 * const { data, currentPage, goToPage } = usePaginatedData<House>({
 *   baseUrl: '/api/houses',
 *   params: { type: houseType, search: searchQuery }
 * })
 * ```
 *
 * @example Infinite scroll
 * ```tsx
 * const { data, isLoadingMore, nextPage, meta } = usePaginatedData<Perfume>({
 *   baseUrl: '/api/perfumes',
 *   accumulate: true // Combines pages into single list
 * })
 * ```
 */
export function usePaginatedData<T = unknown>(options: UsePaginatedDataOptions<T>): UsePaginatedDataReturn<T> {
  const {
    baseUrl,
    initialPage = 1,
    pageSize = 20,
    params = {},
    accumulate = false,
    ...restOptions
  } = options

  const [currentPage, setCurrentPage] = useState(initialPage)
  const [accumulatedData, setAccumulatedData] = useState<T[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Build URL with pagination params
  const buildUrl = useCallback(() => {
    const searchParams = new URLSearchParams()
    searchParams.set("page", currentPage.toString())
    searchParams.set("pageSize", pageSize.toString())

    // Add custom params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value))
      }
    })

    return `${baseUrl}?${searchParams.toString()}`
  }, [
baseUrl, currentPage, pageSize, params
])

  const {
    data: response,
    isLoading,
    isInitialLoading,
    error,
    isError,
    refetch: baseRefetch,
    clearError,
  } = useDataFetching<PaginatedResponse<T>>({
    url: buildUrl,
    deps: [currentPage, pageSize, params],
    ...restOptions,
  })

  // Handle accumulated data for infinite scroll
  const data = accumulate ? accumulatedData : response?.data || []
  const meta = response?.meta || null

  // Update accumulated data when response changes
  if (accumulate && response?.data) {
    if (currentPage === 1) {
      // Reset accumulation on first page
      if (accumulatedData.length !== response.data.length) {
        setAccumulatedData(response.data)
      }
    } else {
      // Append new page data
      const lastId = accumulatedData[accumulatedData.length - 1]
      const firstNewId = response.data[0]

      // Only append if it's actually new data (prevent duplicates)
      if (lastId !== firstNewId) {
        setAccumulatedData(prev => [...prev, ...response.data])
      }
    }
    setIsLoadingMore(false)
  }

  const goToPage = useCallback(
    (page: number) => {
      if (page < 1) {
 return 
}
      if (meta && page > meta.totalPages) {
 return 
}

      if (accumulate && page > currentPage) {
        setIsLoadingMore(true)
      }

      setCurrentPage(page)
    },
    [meta, accumulate, currentPage]
  )

  const nextPage = useCallback(() => {
    if (!meta?.hasMore) {
 return 
}
    goToPage(currentPage + 1)
  }, [currentPage, meta, goToPage])

  const prevPage = useCallback(() => {
    if (currentPage <= 1) {
 return 
}
    goToPage(currentPage - 1)
  }, [currentPage, goToPage])

  const reset = useCallback(() => {
    setCurrentPage(initialPage)
    setAccumulatedData([])
    setIsLoadingMore(false)
  }, [initialPage])

  const refetch = useCallback(async () => {
    if (accumulate) {
      // Reset accumulation and refetch from page 1
      setAccumulatedData([])
      setCurrentPage(1)
    }
    await baseRefetch()
  }, [baseRefetch, accumulate])

  return {
    data,
    meta,
    isLoading,
    isInitialLoading,
    isLoadingMore,
    error,
    isError,
    currentPage,
    goToPage,
    nextPage,
    prevPage,
    refetch,
    reset,
    clearError,
  }
}

export default usePaginatedData




