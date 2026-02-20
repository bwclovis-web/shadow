import { useQuery } from "@tanstack/react-query"

import {
  getHousesByLetter,
  queryKeys,
} from "~/lib/queries/houses"

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
export function useHousesByLetter(
  letter: string | null,
  houseType: string = "all"
) {
  return useQuery({
    queryKey: queryKeys.houses.byLetter(letter || "", houseType),
    queryFn: () => getHousesByLetter(letter!, houseType),
    enabled: !!letter && /^[A-Za-z]$/.test(letter), // Only run if letter is valid
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

