import { useQuery } from "@tanstack/react-query"

import {
  getPerfumesByLetter,
  queryKeys,
} from "~/lib/queries/perfumes"

/**
 * Hook to fetch perfumes by letter and house type.
 * Replaces useDataByLetter for perfumes.
 * 
 * @param letter - Single letter (A-Z) to filter perfumes by name
 * @param houseType - Type of house filter ("all", "niche", "designer", etc.)
 * @param skip - Number of records to skip (default: 0)
 * @param take - Number of records to take (default: 16)
 * @returns Query result with data (perfumes array), isLoading, error, etc.
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePerfumesByLetter('A', 'all', 0, 16)
 * const perfumes = data?.perfumes || []
 * const totalCount = data?.count || 0
 * ```
 */
export function usePerfumesByLetter(
  letter: string | null,
  houseType: string = "all",
  skip: number = 0,
  take: number = 16
) {
  return useQuery({
    queryKey: queryKeys.perfumes.byLetterPaginated(
      letter || "",
      houseType,
      skip,
      take
    ),
    queryFn: () => getPerfumesByLetter(letter!, houseType, skip, take),
    enabled: !!letter && /^[A-Za-z]$/.test(letter), // Only run if letter is valid
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

