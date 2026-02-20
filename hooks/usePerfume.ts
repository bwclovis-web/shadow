import { useQuery } from "@tanstack/react-query"

import { getPerfumeBySlug, queryKeys } from "~/lib/queries/perfumes"

/**
 * Hook to fetch a single perfume by slug with hydration from loader data.
 * 
 * @param slug - Perfume slug
 * @param initialData - Initial data from React Router loader (optional)
 * @returns Query result with perfume data
 * 
 * @example
 * ```tsx
 * const loaderData = useLoaderData<typeof loader>()
 * const { data: perfume } = usePerfume(perfumeSlug, loaderData.perfume)
 * ```
 */
export function usePerfume(slug: string, initialData?: any) {
  return useQuery({
    queryKey: queryKeys.perfumes.detail(slug),
    queryFn: () => getPerfumeBySlug(slug),
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!slug,
  })
}

