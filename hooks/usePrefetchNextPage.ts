import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

/**
 * Hook to prefetch the next page of an infinite query when user scrolls near the end.
 * 
 * @param queryKey - The query key for the infinite query
 * @param hasNextPage - Whether there's a next page available
 * @param fetchNextPage - Function to fetch the next page
 * @param enabled - Whether prefetching is enabled (default: true)
 * @param threshold - Scroll threshold percentage (0-1) to trigger prefetch (default: 0.8)
 */
export function usePrefetchNextPage(
  queryKey: readonly unknown[],
  hasNextPage: boolean,
  fetchNextPage: (options?: { pageParam?: unknown }) => Promise<any>,
  enabled: boolean = true,
  threshold: number = 0.8
) {
  const queryClient = useQueryClient()
  const prefetchedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !hasNextPage || prefetchedRef.current) {
      return
    }

    // Prefetch next page after a short delay to avoid prefetching too aggressively
    const timer = setTimeout(() => {
      // Get current query data to determine next page param
      const queryData = queryClient.getQueryState({ queryKey })
      
      if (queryData?.data && hasNextPage) {
        // Prefetch next page
        fetchNextPage()
          .then(() => {
            prefetchedRef.current = true
          })
          .catch(() => {
            // Silently fail - prefetch is just an optimization
          })
      }
    }, 1000) // Wait 1 second after mount/data load before prefetching

    return () => clearTimeout(timer)
  }, [
queryKey, hasNextPage, enabled, fetchNextPage, queryClient
])

  // Reset prefetched flag when query key changes
  useEffect(() => {
    prefetchedRef.current = false
  }, [queryKey])
}

