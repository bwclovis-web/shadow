/**
 * Consolidated data fetching hook that provides a unified interface
 * for fetching data with loading, error states, and common patterns
 * like caching, debouncing, and retry logic.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { RetryOptions, retryPresets } from "~/utils/retry"

import { useApiWithRetry } from "./useApiWithRetry"

export interface UseDataFetchingOptions<T> {

  /**
   * URL or function that returns a URL to fetch from
   */
  url?: string | (() => string)

  /**
   * Custom fetch function (overrides url)
   */
  fetchFn?: () => Promise<T>

  /**
   * Whether to fetch immediately on mount
   * @default true
   */
  enabled?: boolean

  /**
   * Dependencies that trigger a refetch when changed
   */
  deps?: React.DependencyList

  /**
   * Cache key for localStorage caching
   */
  cacheKey?: string

  /**
   * Cache duration in milliseconds
   * @default 300000 (5 minutes)
   */
  cacheDuration?: number

  /**
   * Debounce delay in milliseconds
   * @default 0 (no debounce)
   */
  debounceMs?: number

  /**
   * Retry options for failed requests
   */
  retryOptions?: RetryOptions

  /**
   * User ID for error logging
   */
  userId?: string

  /**
   * Called when data is successfully fetched
   */
  onSuccess?: (data: T) => void

  /**
   * Called when an error occurs
   */
  onError?: (error: Error) => void

  /**
   * Transform response data before setting state
   */
  transform?: (data: T) => T

  /**
   * Whether to refresh stale cache in background
   * @default false
   */
  staleWhileRevalidate?: boolean
}

export interface UseDataFetchingReturn<T> {

  /**
   * The fetched data
   */
  data: T | null

  /**
   * Whether data is being fetched
   */
  isLoading: boolean

  /**
   * Whether this is the first fetch (no cached data)
   */
  isInitialLoading: boolean

  /**
   * Whether data is being refetched in background
   */
  isRefetching: boolean

  /**
   * Error object if fetch failed
   */
  error: Error | null

  /**
   * Whether an error occurred
   */
  isError: boolean

  /**
   * Manually trigger a refetch
   */
  refetch: () => Promise<void>

  /**
   * Update data manually
   */
  setData: (data: T | null) => void

  /**
   * Clear error state
   */
  clearError: () => void

  /**
   * Clear cached data for this query
   */
  clearCache: () => void
}

interface CachedData<T> {
  data: T
  timestamp: number
}

const CACHE_PREFIX = "data-fetch-"

function getCachedData<T>(cacheKey: string): CachedData<T> | null {
  if (typeof window === "undefined") {
 return null 
}

  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${cacheKey}`)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

function setCachedData<T>(cacheKey: string, data: T): void {
  if (typeof window === "undefined") {
 return 
}

  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${cacheKey}`,
      JSON.stringify({ data, timestamp: Date.now() })
    )
  } catch {
    // Ignore cache errors
  }
}

function isCacheExpired(timestamp: number, cacheDuration: number): boolean {
  return Date.now() - timestamp > cacheDuration
}

/**
 * Universal data fetching hook with caching, debouncing, and retry support
 *
 * @example Basic usage
 * ```tsx
 * const { data, isLoading, error } = useDataFetching<User[]>({
 *   url: '/api/users'
 * })
 * ```
 *
 * @example With caching
 * ```tsx
 * const { data, isLoading } = useDataFetching<Perfume[]>({
 *   url: '/api/perfumes',
 *   cacheKey: 'perfumes-list',
 *   cacheDuration: 600000 // 10 minutes
 * })
 * ```
 *
 * @example With dependencies
 * ```tsx
 * const { data, isLoading } = useDataFetching<House[]>({
 *   url: `/api/houses?type=${houseType}`,
 *   deps: [houseType],
 *   cacheKey: `houses-${houseType}`
 * })
 * ```
 *
 * @example Custom fetch function
 * ```tsx
 * const { data, isLoading } = useDataFetching<Data>({
 *   fetchFn: async () => {
 *     const response = await fetch('/api/data', {
 *       method: 'POST',
 *       body: JSON.stringify(payload)
 *     })
 *     return response.json()
 *   }
 * })
 * ```
 */
export function useDataFetching<T = unknown>(options: UseDataFetchingOptions<T> = {}): UseDataFetchingReturn<T> {
  const {
    url,
    fetchFn,
    enabled = true,
    deps = [],
    cacheKey,
    cacheDuration = 300000, // 5 minutes default
    debounceMs = 0,
    retryOptions,
    userId,
    onSuccess,
    onError,
    transform,
    staleWhileRevalidate = false,
  } = options

  const [data, setDataState] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefetching, setIsRefetching] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const { fetchWithRetry } = useApiWithRetry({
    userId,
    defaultRetryOptions: retryOptions || retryPresets.standard,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load from cache on mount
  useEffect(() => {
    if (cacheKey) {
      const cached = getCachedData<T>(cacheKey)
      if (cached && !isCacheExpired(cached.timestamp, cacheDuration)) {
        setDataState(cached.data)
        setIsInitialLoading(false)

        // If stale-while-revalidate, refetch in background
        if (staleWhileRevalidate && enabled) {
          setIsRefetching(true)
        }
      }
    }
  }, [
cacheKey, cacheDuration, staleWhileRevalidate, enabled
])

  const performFetch = useCallback(
    async (isRefetch = false) => {
      // Cancel any pending requests
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      if (!isRefetch) {
        setIsLoading(true)
      } else {
        setIsRefetching(true)
      }
      setError(null)

      try {
        // Determine fetch function
        let fetchFunction: () => Promise<T>

        if (fetchFn) {
          fetchFunction = fetchFn
        } else if (url) {
          const urlString = typeof url === "function" ? url() : url
          fetchFunction = async () => {
            const response = await fetch(urlString, {
              signal: abortControllerRef.current?.signal,
            })
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
          }
        } else {
          throw new Error("Either url or fetchFn must be provided")
        }

        // Execute with retry
        const result = await fetchWithRetry(fetchFunction, {
          endpoint: typeof url === "function" ? url() : url,
        })

        if (result !== null) {
          // Transform if needed
          const finalData = transform ? transform(result) : result

          setDataState(finalData)
          setIsInitialLoading(false)

          // Cache the result
          if (cacheKey) {
            setCachedData(cacheKey, finalData)
          }

          onSuccess?.(finalData)
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return
        }

        const error = err instanceof Error ? err : new Error("Fetch failed")
        setError(error)
        onError?.(error)
      } finally {
        setIsLoading(false)
        setIsRefetching(false)
      }
    },
    [
url, fetchFn, fetchWithRetry, transform, onSuccess, onError, cacheKey
]
  )

  const refetch = useCallback(async () => {
    if (data !== null) {
      await performFetch(true)
    } else {
      await performFetch(false)
    }
  }, [performFetch, data])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const clearCache = useCallback(() => {
    if (cacheKey && typeof window !== "undefined") {
      localStorage.removeItem(`${CACHE_PREFIX}${cacheKey}`)
    }
  }, [cacheKey])

  // Fetch effect with debouncing
  useEffect(() => {
    if (!enabled) {
 return 
}

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce if configured
    if (debounceMs > 0) {
      debounceTimerRef.current = setTimeout(() => {
        performFetch()
      }, debounceMs)
    } else {
      performFetch()
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      abortControllerRef.current?.abort()
    }
  }, [
enabled, ...deps, performFetch, debounceMs
])

  return {
    data,
    isLoading,
    isInitialLoading,
    isRefetching,
    error,
    isError: error !== null,
    refetch,
    setData: setDataState,
    clearError,
    clearCache,
  }
}

export default useDataFetching




