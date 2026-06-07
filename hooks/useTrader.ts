import { useQuery } from "@tanstack/react-query"

import { getTraderById, queryKeys, type TraderResponse } from "@/lib/queries/user"

/**
 * Hook to fetch a trader profile by ID with optional SSR hydration.
 *
 * @param traderId - Trader/User ID
 * @param initialData - Data prefetched in the server `page.tsx` (optional)
 */
export const useTrader = (traderId: string, initialData?: TraderResponse) =>
  useQuery({
    queryKey: queryKeys.user.trader(traderId),
    queryFn: () => getTraderById(traderId),
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    staleTime: 60 * 1000, // 1 minute — profile edits should show soon on trader page
    enabled: !!traderId,
    refetchOnMount: true,
  })

