import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  type DataQualityTimeframe,
  getDataQualityStats,
  queryKeys,
} from "@/lib/queries/dataQuality"

/**
 * Hook to fetch data quality statistics using TanStack Query.
 *
 * @param timeframe - Timeframe for the statistics: "week", "month", or "all"
 */
export const useFetchDataQualityStats = (timeframe: DataQualityTimeframe) => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.dataQuality.stats(timeframe, false),
    queryFn: () => getDataQualityStats(timeframe, false),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  })

  const forceRefresh = async (force: boolean = false) => {
    if (force) {
      const freshData = await queryClient.fetchQuery({
        queryKey: queryKeys.dataQuality.stats(timeframe, force),
        queryFn: () => getDataQualityStats(timeframe, force),
      })
      queryClient.setQueryData(queryKeys.dataQuality.stats(timeframe, false), freshData)
    } else {
      await query.refetch()
    }
  }

  const isInitialLoad = query.isLoading && !query.data

  return {
    stats: query.data ?? null,
    /** True only when there is no data to show yet (first load or new timeframe with no placeholder). */
    isInitialLoad,
    /** True during any in-flight request including background refetch. */
    isFetching: query.isFetching,
    error: query.error
      ? `Failed to fetch data quality stats: ${
          query.error instanceof Error
            ? query.error.message
            : String(query.error)
        }`
      : null,
    forceRefresh,
    refetch: query.refetch,
  }
}
