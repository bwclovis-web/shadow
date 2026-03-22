import { useQuery } from "@tanstack/react-query"

import {
  compareQueryKeys,
  fetchComparePerfumes,
} from "@/lib/queries/compare"

/**
 * Loads compare rows for the current tray order (CF-002). Same fetcher CF-003 can drive via URL.
 */
export function useComparePayload(orderedIds: string[]) {
  return useQuery({
    queryKey: compareQueryKeys.byOrderedIds(orderedIds),
    queryFn: () => fetchComparePerfumes(orderedIds),
    enabled: orderedIds.length > 0,
  })
}
