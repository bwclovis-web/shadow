import { useQuery } from "@tanstack/react-query"

import { getPerfumeBySlug, queryKeys } from "@/lib/queries/perfumes"

const STALE_TIME_5_MIN = 5 * 60 * 1000

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
export const usePerfume = (slug: string, initialData?: unknown) =>
  useQuery({
    queryKey: queryKeys.perfumes.detail(slug),
    queryFn: () => getPerfumeBySlug(slug),
    initialData,
    initialDataUpdatedAt: initialData != null ? Date.now() : undefined,
    staleTime: STALE_TIME_5_MIN,
    enabled: !!slug,
  })

