import { useInfiniteQuery } from "@tanstack/react-query"

import {
  getHousesByLetterPaginated,
  queryKeys,
} from "@/lib/queries/houses"

const LETTER_REGEX = /^[A-Za-z]$/
const STALE_TIME_MS = 5 * 60 * 1000

interface UseInfiniteHousesOptions {
  letter: string | null
  houseType?: string
  pageSize?: number
  initialData?: unknown[]
  initialTotalCount?: number
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
export const useInfiniteHouses = (options: UseInfiniteHousesOptions) => {
  const {
    letter,
    houseType = "all",
    pageSize = 16,
    initialData,
    initialTotalCount,
  } = options

  const isLetterValid = !!letter && LETTER_REGEX.test(letter)
  const totalCount = initialTotalCount ?? initialData?.length ?? 0

  return useInfiniteQuery({
    queryKey: queryKeys.houses.byLetterInfinite(letter ?? "", houseType),
    queryFn: ({ pageParam }) =>
      getHousesByLetterPaginated(letter!, houseType, pageParam as number, pageSize),
    enabled: isLetterValid,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasMore
        ? (lastPage.meta.skip ?? 0) + (lastPage.meta.take ?? pageSize)
        : undefined,
    staleTime: STALE_TIME_MS,
    placeholderData: initialData
      ? {
          pages: [
            {
              success: true,
              houses: initialData,
              count: initialData.length,
              meta: {
                letter: letter ?? "",
                houseType,
                skip: 0,
                take: pageSize,
                hasMore: totalCount > initialData.length,
                totalCount,
              },
            },
          ],
          pageParams: [0],
        }
      : undefined,
  })
}

