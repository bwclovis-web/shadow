import { useInfiniteQuery } from "@tanstack/react-query"

import {
  getMorePerfumes,
  getPerfumesByLetter,
  queryKeys,
} from "@/lib/queries/perfumes"

const STALE_TIME_5_MIN = 5 * 60 * 1000

/** Next skip for offset pagination must match how many rows the previous page actually contained, not the requested `take` (can differ from SSR/hydration). */
const countReturnedPerfumes = (lastPage: {
  perfumes?: unknown[]
  meta?: { take?: number }
}) => {
  if (Array.isArray(lastPage.perfumes)) return lastPage.perfumes.length
  return lastPage.meta?.take ?? 0
}

const getNextPageParam =
  (pageSize: number) =>
  (lastPage: {
    meta?: { hasMore?: boolean; skip?: number; take?: number }
    perfumes?: unknown[]
  }) => {
    if (!lastPage.meta?.hasMore) return undefined
    const skip = lastPage.meta.skip ?? 0
    const returned = countReturnedPerfumes(lastPage)
    return skip + (returned > 0 ? returned : (lastPage.meta.take ?? pageSize))
  }

interface UseInfinitePerfumesByLetterOptions {
  letter: string | null
  houseType?: string
  pageSize?: number
  initialData?: any[]
  initialTotalCount?: number
}

interface UseInfinitePerfumesByHouseOptions {
  houseSlug: string
  pageSize?: number
  initialData?: any[]
  initialTotalCount?: number
  /** Pass only when SSR first page matches these params (avoids wrong placeholder). */
  sortBy?: string
  q?: string
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
export const useInfinitePerfumesByLetter = (
  options: UseInfinitePerfumesByLetterOptions
) => {
  const { letter, houseType = "all", pageSize = 16, initialData, initialTotalCount } = options
  const totalCount = initialTotalCount ?? initialData?.length ?? 0

  return useInfiniteQuery({
    queryKey: queryKeys.perfumes.byLetterInfinite(letter || "", houseType, pageSize),
    queryFn: ({ pageParam }) =>
      getPerfumesByLetter(letter!, houseType, pageParam as number, pageSize),
    enabled: !!letter && /^[A-Za-z]$/.test(letter),
    initialPageParam: 0,
    getNextPageParam: getNextPageParam(pageSize),
    staleTime: STALE_TIME_5_MIN,
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
                take:
                  initialData.length > 0 ? initialData.length : pageSize,
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
export const useInfinitePerfumesByHouse = (
  options: UseInfinitePerfumesByHouseOptions
) => {
  const {
    houseSlug,
    pageSize = 9,
    initialData,
    initialTotalCount,
    sortBy = "",
    q = "",
  } = options
  const derivedInitialTotal = initialTotalCount ?? initialData?.length ?? 0

  return useInfiniteQuery({
    queryKey: queryKeys.perfumes.byHouseInfinite(houseSlug, sortBy, q, pageSize),
    queryFn: ({ pageParam }) =>
      getMorePerfumes(houseSlug, {
        skip: pageParam as number,
        take: pageSize,
        ...(sortBy ? { sortBy } : {}),
        ...(q ? { q } : {}),
      }),
    enabled: !!houseSlug,
    initialPageParam: 0,
    getNextPageParam: getNextPageParam(pageSize),
    staleTime: STALE_TIME_5_MIN,
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
                take:
                  initialData.length > 0 ? initialData.length : pageSize,
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

