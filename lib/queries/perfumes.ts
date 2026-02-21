/**
 * Query functions and query keys for Perfumes
 * 
 * This module provides query functions for fetching perfumes data from the API
 * and query key factories for TanStack Query cache management.
 */

export interface PerfumeFilters {
  sortBy?: "name-asc" | "name-desc" | "created-desc" | "created-asc" | "type-asc"
  houseId?: string
}

export interface PerfumePagination {
  skip?: number
  take?: number
}

export interface PerfumesByLetterResponse {
  success: boolean
  perfumes: any[]
  count: number
  meta: {
    letter: string
    skip: number
    take: number
    hasMore: boolean
    totalCount: number
  }
}

export interface MorePerfumesResponse {
  success: boolean
  perfumes: any[]
  meta: {
    houseName: string
    skip: number
    take: number
    hasMore: boolean
    count: number
    totalCount: number
  }
}

/**
 * Query key factory for perfumes queries.
 * Uses hierarchical structure for easy invalidation.
 */
export const queryKeys = {
  perfumes: {
    all: ["perfumes"] as const,
    lists: () => [...queryKeys.perfumes.all, "list"] as const,
    list: (filters: PerfumeFilters) => [...queryKeys.perfumes.lists(), filters] as const,
    details: () => [...queryKeys.perfumes.all, "detail"] as const,
    detail: (slug: string) => [...queryKeys.perfumes.details(), slug] as const,
    byLetter: (letter: string, houseType: string = "all") => [
...queryKeys.perfumes.all, "byLetter", letter, houseType
] as const,
    // For infinite queries - don't include pagination params in key
    // All pages share the same cache entry
    byLetterInfinite: (letter: string, houseType: string) => [
...queryKeys.perfumes.all, "byLetterInfinite", letter, houseType
] as const,
    byHouse: (houseSlug: string) => [...queryKeys.perfumes.all, "byHouse", houseSlug] as const,
    byHouseInfinite: (houseSlug: string) => [...queryKeys.perfumes.all, "byHouseInfinite", houseSlug] as const,
  },
} as const

/**
 * Fetch perfumes by letter and house type with pagination.
 * 
 * @param letter - Single letter (A-Z) to filter perfumes by name
 * @param houseType - Type of house filter ("all", "niche", "designer", etc.)
 * @param skip - Number of records to skip (default: 0)
 * @param take - Number of records to take (default: 16)
 * @returns Promise resolving to perfumes response with metadata
 */
export async function getPerfumesByLetter(
  letter: string,
  houseType: string = "all",
  skip: number = 0,
  take: number = 16
): Promise<PerfumesByLetterResponse> {
  if (!letter || !/^[A-Za-z]$/.test(letter)) {
    throw new Error("Valid letter parameter is required (single letter A-Z)")
  }

  const params = new URLSearchParams({
    letter: letter.toUpperCase(),
    houseType,
    skip: skip.toString(),
    take: take.toString(),
  })

  const response = await fetch(`/api/perfumes-by-letter?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch perfumes by letter: ${response.statusText}`)
  }

  const data: PerfumesByLetterResponse = await response.json()

  if (!data.success) {
    throw new Error("Failed to fetch perfumes by letter")
  }

  return data
}

/**
 * Fetch a single perfume by slug.
 * Note: Currently loaded via server loader, but this provides a client-side query function.
 * 
 * @param slug - Perfume slug identifier
 * @returns Promise resolving to perfume object
 */
export async function getPerfumeBySlug(slug: string): Promise<any> {
  if (!slug) {
    throw new Error("Perfume slug is required")
  }

  // Note: This endpoint may need to be created if it doesn't exist
  // For now, we'll use a pattern that matches the server loader
  // If an API endpoint exists, use: `/api/perfume/${slug}`
  // Otherwise, this will need to be implemented as an API route
  const response = await fetch(`/api/perfume/${slug}`)

  if (response.status === 404) {
    throw new Error("Perfume not found")
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch perfume: ${response.statusText}`)
  }

  const data = await response.json()

  return data.perfume || data
}

/**
 * Fetch more perfumes for a specific house (used for infinite scroll).
 * 
 * @param houseSlug - Slug of the perfume house
 * @param pagination - Pagination parameters (skip, take)
 * @returns Promise resolving to perfumes response with metadata
 */
export async function getMorePerfumes(
  houseSlug: string,
  pagination: PerfumePagination = {}
): Promise<MorePerfumesResponse> {
  if (!houseSlug) {
    throw new Error("House slug is required")
  }

  const { skip = 0, take = 9 } = pagination

  const params = new URLSearchParams({
    houseSlug,
    skip: skip.toString(),
    take: take.toString(),
  })

  const response = await fetch(`/api/more-perfumes?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch more perfumes: ${response.statusText}`)
  }

  const data: MorePerfumesResponse = await response.json()

  if (!data.success) {
    throw new Error(data.meta?.houseName ? "House not found" : "Failed to fetch more perfumes")
  }

  return data
}

/**
 * Fetch perfumes with sorting and filtering.
 * 
 * @param filters - Filter and sorting options
 * @returns Promise resolving to perfumes array
 */
export async function getPerfumeSort(filters: PerfumeFilters = {}): Promise<any[]> {
  const { sortBy = "created-desc" } = filters

  const params = new URLSearchParams()

  if (sortBy) {
    params.append("sortBy", sortBy)
  }

  const queryString = params.toString()
  const url = queryString
    ? `/api/perfumeSortLoader?${queryString}`
    : "/api/perfumeSortLoader"

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch perfumes: ${response.statusText}`)
  }

  const data = await response.json()

  // API returns array directly or wrapped in a result object
  return Array.isArray(data) ? data : data.perfumes || data.result || []
}

