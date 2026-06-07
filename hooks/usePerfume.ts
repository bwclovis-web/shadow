import { useQuery } from "@tanstack/react-query"

import { getPerfumeBySlug, queryKeys } from "@/lib/queries/perfumes"

const STALE_TIME_5_MIN = 5 * 60 * 1000

/**
 * Hook to fetch a single perfume by slug with optional SSR hydration.
 *
 * @param slug - Perfume slug
 * @param initialData - Data prefetched in the server `page.tsx` (optional)
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

