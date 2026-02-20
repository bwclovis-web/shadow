import { useQuery } from "@tanstack/react-query"

import { type HouseFilters, housesQueryOptions } from "~/lib/queries/houses"

/**
 * Hook to fetch houses with filtering and sorting.
 * Replaces useHousesWithLocalCache with TanStack Query.
 * Uses queryOptions factory for better type safety and consistency.
 * 
 * @param filters - Filter and sorting options
 * @param options - Additional query options (select, refetchOnMount, etc.)
 * @returns Query result with data, isLoading, error, etc.
 * 
 * @example
 * ```tsx
 * const { data: houses, isLoading, error } = useHouses({
 *   houseType: 'niche',
 *   sortBy: 'name-asc'
 * })
 * 
 * // With select to extract only names
 * const { data: houseNames } = useHouses(
 *   { houseType: 'niche' },
 *   { select: (data) => data.map(h => h.name) }
 * )
 * ```
 */
export function useHouses(
  filters: HouseFilters = {},
  options?: {
    select?: (data: any) => any
    refetchOnMount?: boolean | "always"
    enabled?: boolean
  }
) {
  return useQuery({
    ...housesQueryOptions(filters),
    ...options,
  })
}

