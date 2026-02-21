/**
 * Query functions and query keys for Houses (Perfume Houses)
 * 
 * This module provides query functions for fetching houses data from the API
 * and query key factories for TanStack Query cache management.
 */

export interface HouseFilters {
  houseType?: string
  sortBy?: "name-asc" | "name-desc" | "created-desc" | "created-asc" | "type-asc"
  sortByType?: boolean
  page?: number
  limit?: number
  skip?: number
  take?: number
}

export interface HousesByLetterResponse {
  success: boolean
  houses: any[]
  count: number
}

export interface HousesPaginatedResponse {
  houses: any[]
  count: number
  hasMore?: boolean
  currentPage?: number
  totalPages?: number
}

export interface HousesByLetterPaginatedResponse {
  success: boolean
  houses: any[]
  count: number
  meta: {
    letter: string
    houseType: string
    skip: number
    take: number
    hasMore: boolean
    totalCount: number
  }
}

/**
 * Query key factory for houses queries.
 * Uses hierarchical structure for easy invalidation.
 */
export const queryKeys = {
  houses: {
    all: ["houses"] as const,
    lists: () => [...queryKeys.houses.all, "list"] as const,
    list: (filters: HouseFilters) => [...queryKeys.houses.lists(), filters] as const,
    details: () => [...queryKeys.houses.all, "detail"] as const,
    detail: (slug: string) => [...queryKeys.houses.details(), slug] as const,
    byLetter: (letter: string, houseType: string = "all") => [
...queryKeys.houses.all, "byLetter", letter, houseType
] as const,
    paginated: (filters: HouseFilters) => [...queryKeys.houses.all, "paginated", filters] as const,
    // For infinite queries - don't include pagination params in key
    // All pages share the same cache entry
    byLetterInfinite: (letter: string, houseType: string) => [
...queryKeys.houses.all, "byLetterInfinite", letter, houseType
] as const,
  },
} as const

/**
 * Fetch houses by letter and house type.
 * 
 * @param letter - Single letter (A-Z) to filter houses by name
 * @param houseType - Type of house filter ("all", "niche", "designer", etc.)
 * @returns Promise resolving to houses array
 */
export async function getHousesByLetter(
  letter: string,
  houseType: string = "all"
): Promise<any[]> {
  if (!letter || !/^[A-Za-z]$/.test(letter)) {
    throw new Error("Valid letter parameter is required (single letter A-Z)")
  }

  const params = new URLSearchParams({
    letter: letter.toUpperCase(),
    houseType,
  })

  const response = await fetch(`/api/houses-by-letter?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch houses by letter: ${response.statusText}`)
  }

  const data: HousesByLetterResponse = await response.json()

  if (!data.success) {
    throw new Error("Failed to fetch houses by letter")
  }

  return data.houses || []
}

/**
 * Fetch houses with pagination and sorting.
 * Replaces the functionality of useHousesWithLocalCache.
 * 
 * @param filters - Filter and pagination options
 * @returns Promise resolving to paginated houses response
 */
export async function getHousesPaginated(filters: HouseFilters = {}): Promise<HousesPaginatedResponse> {
  const {
    houseType = "all",
    sortBy = "created-desc",
    sortByType = false,
    page = 1,
    limit = 50,
  } = filters

  const params = new URLSearchParams({
    houseType,
    sortBy,
    page: page.toString(),
    limit: limit.toString(),
  })

  if (sortByType) {
    params.append("sortByType", "true")
  }

  const response = await fetch(`/api/houseSortLoader?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch houses: ${response.statusText}`)
  }

  const data: HousesPaginatedResponse = await response.json()

  return (
    data || {
      houses: [],
      count: 0,
      hasMore: false,
      currentPage: 1,
      totalPages: 1,
    }
  )
}

/**
 * Fetch houses sorted by filters.
 * This is the main query function that replaces useHousesWithLocalCache.
 * 
 * @param filters - Filter and sorting options
 * @returns Promise resolving to houses array
 */
export async function getHouseSort(filters: HouseFilters = {}): Promise<any[]> {
  const result = await getHousesPaginated(filters)
  return result.houses || []
}

/**
 * Fetch a single house by slug.
 * Note: Currently loaded via server loader, but this provides a client-side query function.
 * 
 * @param slug - House slug identifier
 * @returns Promise resolving to house object
 */
export async function getHouseBySlug(slug: string): Promise<any> {
  if (!slug) {
    throw new Error("House slug is required")
  }

  // Note: This endpoint may need to be created if it doesn't exist
  // For now, we'll use a pattern that matches the server loader
  // If an API endpoint exists, use: `/api/perfume-house/${slug}`
  // Otherwise, this will need to be implemented as an API route
  const response = await fetch(`/api/perfume-house/${slug}`)

  if (response.status === 404) {
    throw new Error("House not found")
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch house: ${response.statusText}`)
  }

  const data = await response.json()

  return data.perfumeHouse || data
}

/**
 * Fetch houses by letter with pagination.
 * 
 * @param letter - Single letter (A-Z) to filter houses by name
 * @param houseType - Type of house filter ("all", "niche", "designer", etc.)
 * @param skip - Number of records to skip
 * @param take - Number of records to take
 * @returns Promise resolving to paginated houses response
 */
export async function getHousesByLetterPaginated(
  letter: string,
  houseType: string = "all",
  skip: number = 0,
  take: number = 16
): Promise<HousesByLetterPaginatedResponse> {
  if (!letter || !/^[A-Za-z]$/.test(letter)) {
    throw new Error("Valid letter parameter is required (single letter A-Z)")
  }

  const params = new URLSearchParams({
    letter: letter.toUpperCase(),
    houseType,
    skip: skip.toString(),
    take: take.toString(),
  })

  const response = await fetch(`/api/houses-by-letter-paginated?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch houses by letter (paginated): ${response.statusText}`)
  }

  const data: HousesByLetterPaginatedResponse = await response.json()

  if (!data.success) {
    throw new Error("Failed to fetch houses by letter (paginated)")
  }

  return data
}

/**
 * Query options factory for houses queries.
 * Provides type-safe, reusable query configurations.
 * 
 * @example
 * ```tsx
 * const { data } = useQuery(housesQueryOptions({ houseType: 'niche' }))
 * ```
 */
export const housesQueryOptions = (filters: HouseFilters = {}) => ({
  queryKey: queryKeys.houses.list(filters),
  queryFn: () => getHouseSort(filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
}) as const

/**
 * Query options factory for fetching a house by slug.
 */
export const houseBySlugQueryOptions = (slug: string) => ({
  queryKey: queryKeys.houses.detail(slug),
  queryFn: () => getHouseBySlug(slug),
  staleTime: 5 * 60 * 1000,
  enabled: !!slug,
}) as const

