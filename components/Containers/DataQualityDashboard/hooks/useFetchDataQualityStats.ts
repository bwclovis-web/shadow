import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  type DataQualityTimeframe,
  getDataQualityStats,
  queryKeys,
} from "~/lib/queries/dataQuality"

/**
 * Hook to fetch data quality statistics using TanStack Query.
 * Replaces manual fetch logic with useQuery for better caching and state management.
 * 
 * @param timeframe - Timeframe for the statistics: "week", "month", or "all"
 * @returns Query result with stats, loading, error, and forceRefresh function
 */
export const useFetchDataQualityStats = (timeframe: DataQualityTimeframe) => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.dataQuality.stats(timeframe, false),
    queryFn: () => getDataQualityStats(timeframe, false),
    staleTime: 0, // Always consider data stale to ensure fresh updates
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
    refetchOnMount: "always", // Always refetch when component mounts to ensure fresh data
  })

  // Force refresh function that can trigger regeneration
  const forceRefresh = async (force: boolean = false) => {
    if (force) {
      // For force refresh, fetch with force=true and update cache
      const freshData = await queryClient.fetchQuery({
        queryKey: queryKeys.dataQuality.stats(timeframe, force),
        queryFn: () => getDataQualityStats(timeframe, force),
      })
      // Update the cache for the non-force query key too
      queryClient.setQueryData(
        queryKeys.dataQuality.stats(timeframe, false),
        freshData
      )
    } else {
      // Regular refetch
      await query.refetch()
    }
  }

  return {
    stats: query.data || null,
    loading: query.isLoading || query.isFetching, // Also show loading when refetching
    error: query.error
      ? `Failed to fetch data quality stats: ${
          query.error instanceof Error
            ? query.error.message
            : String(query.error)
        }`
      : null,
    forceRefresh,
    refetch: query.refetch, // Expose refetch function
  }
}
