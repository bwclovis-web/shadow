import { getHousesByLetterPaginated, queryKeys as houseQueryKeys } from "@/lib/queries/houses"
import { getPerfumesByLetter, queryKeys as perfumeQueryKeys } from "@/lib/queries/perfumes"
import { queryClient } from "@/lib/queryClient"

const STALE_TIME_MS = 5 * 60 * 1000
const LETTER_REGEX = /^[A-Za-z]$/

const isValidLetter = (letter: string): boolean =>
  !!letter && LETTER_REGEX.test(letter)

const createGetNextPageParam = (pageSize: number) =>
  (lastPage: {
    meta?: { hasMore?: boolean; skip?: number; take?: number }
    perfumes?: unknown[]
    houses?: unknown[]
  }) => {
    if (!lastPage.meta?.hasMore) return undefined
    const skip = lastPage.meta.skip ?? 0
    const rows = lastPage.perfumes ?? lastPage.houses
    const returned = Array.isArray(rows) ? rows.length : 0
    return skip + (returned > 0 ? returned : (lastPage.meta.take ?? pageSize))
  }

/**
 * Prefetch houses by letter on hover for better UX.
 */
export const prefetchHousesByLetter = async (
  letter: string,
  houseType = "all",
  pageSize = 16
): Promise<void> => {
  if (!isValidLetter(letter)) return

  await queryClient.prefetchInfiniteQuery({
    queryKey: houseQueryKeys.houses.byLetterInfinite(letter, houseType, pageSize),
    queryFn: ({ pageParam }) =>
      getHousesByLetterPaginated(letter, houseType, pageParam as number, pageSize),
    initialPageParam: 0,
    getNextPageParam: createGetNextPageParam(pageSize),
    staleTime: STALE_TIME_MS,
  })
}

/**
 * Prefetch perfumes by letter on hover for better UX.
 */
export const prefetchPerfumesByLetter = async (
  letter: string,
  houseType = "all",
  pageSize = 16
): Promise<void> => {
  if (!isValidLetter(letter)) return

  await queryClient.prefetchInfiniteQuery({
    queryKey: perfumeQueryKeys.perfumes.byLetterInfinite(letter, houseType, pageSize),
    queryFn: ({ pageParam }) =>
      getPerfumesByLetter(letter, houseType, pageParam as number, pageSize),
    initialPageParam: 0,
    getNextPageParam: createGetNextPageParam(pageSize),
    staleTime: STALE_TIME_MS,
  })
}
