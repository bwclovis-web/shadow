import { useQuery } from "@tanstack/react-query"

import { getHouseBySlug, queryKeys } from "~/lib/queries/houses"

/**
 * Hook to fetch a single house by slug with hydration from loader data.
 * 
 * @param slug - House slug
 * @param initialData - Initial data from React Router loader (optional)
 * @returns Query result with house data
 * 
 * @example
 * ```tsx
 * const loaderData = useLoaderData<typeof loader>()
 * const { data: house } = useHouse(houseSlug, loaderData.perfumeHouse)
 * ```
 */
export function useHouse(slug: string, initialData?: any) {
  return useQuery({
    queryKey: queryKeys.houses.detail(slug),
    queryFn: () => getHouseBySlug(slug),
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!slug,
  })
}

