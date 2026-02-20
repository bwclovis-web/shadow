import { useQuery } from "@tanstack/react-query"

import { getTraderById, queryKeys } from "~/lib/queries/user"

/**
 * Hook to fetch a trader profile by ID with hydration from loader data.
 * 
 * @param traderId - Trader/User ID
 * @param initialData - Initial data from React Router loader (optional)
 * @returns Query result with trader data
 * 
 * @example
 * ```tsx
 * const loaderData = useLoaderData<typeof loader>()
 * const { data: trader } = useTrader(traderId, loaderData.trader)
 * ```
 */
export function useTrader(traderId: string, initialData?: any) {
  return useQuery({
    queryKey: queryKeys.user.trader(traderId),
    queryFn: () => getTraderById(traderId),
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!traderId,
  })
}

