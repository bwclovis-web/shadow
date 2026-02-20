import { useInfiniteQuery } from "@tanstack/react-query"

import {
  getMorePerfumes,
  getPerfumesByLetter,
  queryKeys,
} from "~/lib/queries/perfumes"

interface UseInfinitePerfumesByLetterOptions {
  letter: string | null
  houseType?: string
  pageSize?: number
  initialData?: any[]
}

interface UseInfinitePerfumesByHouseOptions {
  houseSlug: string
  pageSize?: number
  initialData?: any[]
  initialTotalCount?: number
}

/**
 * Hook to fetch perfumes by letter with infinite scroll pagination.
 * Replaces useInfiniteScrollPerfumes with TanStack Query useInfiniteQuery.
 * 
 * @param options - Configuration options
 * @returns Infinite query result with pages, hasNextPage, fetchNextPage, etc.
 * 
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useInfinitePerfumesByLetter({
 *   letter: 'A',
 *   houseType: 'all',
 *   pageSize: 16
 * })
 * const perfumes = data?.pages.flatMap(page => page.perfumes) || []
 * ```
 */
export function useInfinitePerfumesByLetter(options: UseInfinitePerfumesByLetterOptions) {
  const {
    letter,
    houseType = "all",
    pageSize = 16,
    initialData,
  } = options

  return useInfiniteQuery({
    // Use infinite-specific query key without pagination params
    queryKey: queryKeys.perfumes.byLetterInfinite(letter || "", houseType),
    queryFn: ({ pageParam }) => {
      const skip = pageParam as number
      return getPerfumesByLetter(letter!, houseType, skip, pageSize)
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
              perfumes: initialData,
              count: initialData.length,
              meta: {
                letter: letter || "",
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

/**
 * Hook to fetch perfumes by house with infinite scroll pagination.
 * Replaces useInfiniteScroll with TanStack Query useInfiniteQuery.
 * 
 * @param options - Configuration options
 * @returns Infinite query result with pages, hasNextPage, fetchNextPage, etc.
 * 
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useInfinitePerfumesByHouse({
 *   houseSlug: 'chanel',
 *   pageSize: 9,
 *   initialData: initialPerfumes
 * })
 * const perfumes = data?.pages.flatMap(page => page.perfumes) || []
 * ```
 */
export function useInfinitePerfumesByHouse(options: UseInfinitePerfumesByHouseOptions) {
  const {
    houseSlug,
    pageSize = 9,
    initialData,
    initialTotalCount,
  } = options
  const derivedInitialTotal =
    typeof initialTotalCount === "number"
      ? initialTotalCount
      : initialData?.length ?? 0

  return useInfiniteQuery({
    // Use infinite-specific query key without pagination params
    queryKey: queryKeys.perfumes.byHouseInfinite(houseSlug),
    queryFn: ({ pageParam }) => {
      const skip = pageParam as number
      return getMorePerfumes(houseSlug, { skip, take: pageSize })
    },
    enabled: !!houseSlug,
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
              perfumes: initialData,
              meta: {
                houseName: "",
                skip: 0, // First page starts at 0
                take: pageSize,
                hasMore: derivedInitialTotal > initialData.length,
                count: initialData.length,
                totalCount: derivedInitialTotal,
              },
            },
          ],
          pageParams: [0],
        }
      : undefined,
  })
}

