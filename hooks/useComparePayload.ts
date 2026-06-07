import { useQuery } from "@tanstack/react-query"

import {
  compareQueryKeys,
  fetchComparePerfumes,
} from "@/lib/queries/compare"
import type { ComparePerfumeDto } from "@/models/compare.server"

type UseComparePayloadOptions = {
  /** SSR-hydrated rows — skips duplicate fetch on first paint when ids match. */
  initialData?: ComparePerfumeDto[]
}

/**
 * Loads compare rows for the current tray order (CF-002). Same fetcher CF-003 can drive via URL.
 */
export const useComparePayload = (
  orderedIds: string[],
  options?: UseComparePayloadOptions
) => {
  const { initialData } = options ?? {}

  return useQuery({
    queryKey: compareQueryKeys.byOrderedIds(orderedIds),
    queryFn: () => fetchComparePerfumes(orderedIds),
    enabled: orderedIds.length > 0,
    initialData,
    staleTime: initialData ? 30_000 : 0,
  })
}
