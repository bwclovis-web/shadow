import { useQuery } from "@tanstack/react-query"

import {
  getHousesByLetter,
  queryKeys,
} from "@/lib/queries/houses"

const STALE_TIME_5_MIN = 5 * 60 * 1000

const isValidLetter = (letter: string) => /^[A-Za-z]$/.test(letter)

/**
 * Hook to fetch houses by letter and house type.
 * Replaces useDataByLetter for houses.
 *
 * @param letter - Single letter (A-Z) to filter houses by name
 * @param houseType - Type of house filter ("all", "niche", "designer", etc.)
 * @returns Query result with data, isLoading, error, etc.
 *
 * @example
 * ```tsx
 * const { data: houses, isLoading, error } = useHousesByLetter('A', 'niche')
 * ```
 */
export const useHousesByLetter = (
  letter: string | null,
  houseType: string = "all"
) =>
  useQuery({
    queryKey: queryKeys.houses.byLetter(letter || "", houseType),
    queryFn: () => getHousesByLetter(letter!, houseType),
    enabled: !!letter && isValidLetter(letter),
    staleTime: STALE_TIME_5_MIN,
  })

