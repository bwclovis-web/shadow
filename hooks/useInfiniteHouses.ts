import { useInfiniteQuery } from "@tanstack/react-query"

import {
  getHousesByLetterPaginated,
  queryKeys,
} from "~/lib/queries/houses"

interface UseInfiniteHousesOptions {
  letter: string | null
  houseType?: string
  pageSize?: number
  initialData?: any[]
}

/**
 * Hook to fetch houses by letter with infinite scroll pagination.
 * Replaces useInfiniteScrollHouses with TanStack Query useInfiniteQuery.
 * 
 * @param options - Configuration options
 * @returns Infinite query result with pages, hasNextPage, fetchNextPage, etc.
 * 
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteHouses({
 *   letter: 'A',
 *   houseType: 'niche',
 *   pageSize: 16
 * })
 * const houses = data?.pages.flatMap(page => page.houses) || []
 * ```
 */
export function useInfiniteHouses(options: UseInfiniteHousesOptions) {
  const {
    letter,
    houseType = "all",
    pageSize = 16,
    initialData,
  } = options

  return useInfiniteQuery({
    // Use infinite-specific query key without pagination params
    queryKey: queryKeys.houses.byLetterInfinite(letter || "", houseType),
    queryFn: ({ pageParam }) => {
      const skip = pageParam as number
      return getHousesByLetterPaginated(letter!, houseType, skip, pageSize)
    },
    enabled: !!letter && /^[A-Za-z]$/.test(letter),
    initialPageParam: 0,
    getNextPageParam: lastPage => {
      // Check if there's more data based on metadata
      if (lastPage.meta?.hasMore) {
        // Return the next skip value (current skip + take)
        return (lastPage.meta.skip || 0) + (lastPage.meta.take || pageSize)
      }
      return undefined // No more pages
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Use placeholderData for non-SSR scenarios or when you want stale-while-revalidate behavior
    placeholderData: initialData
      ? {
          pages: [
            {
              success: true,
              houses: initialData,
              count: initialData.length,
              meta: {
                letter: letter || "",
                houseType,
                skip: 0,
                take: pageSize,
                hasMore: initialData.length === pageSize,
                totalCount: initialData.length,
              },
            },
          ],
          pageParams: [0],
        }
      : undefined,
  })
}

