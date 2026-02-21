/**
 * Query functions and query keys for Data Quality
 * 
 * This module provides query functions for fetching data quality statistics
 * and related data from the API.
 */

export type DataQualityTimeframe = "week" | "month" | "all"

export interface DataQualityStats {
  totalMissing: number
  totalDuplicates: number
  totalHousesNoPerfumes?: number
  missingByBrand: Record<string, number>
  duplicatesByBrand: Record<string, number>
  lastUpdated: string
  historyData?: {
    dates: string[]
    missing: number[]
    duplicates: number[]
  }
  totalMissingHouseInfo?: number
  missingHouseInfoByBrand?: Record<string, number>
  housesNoPerfumes?: Array<{
    id: string
    name: string
    type: string
    createdAt: string
  }>
}

/**
 * Query key factory for data quality queries.
 * Uses hierarchical structure for easy invalidation.
 */
export const queryKeys = {
  dataQuality: {
    all: ["dataQuality"] as const,
    stats: (timeframe: DataQualityTimeframe, force?: boolean) => [
        ...queryKeys.dataQuality.all,
        "stats",
        timeframe,
        force,
      ] as const,
    houses: () => [...queryKeys.dataQuality.all, "houses"] as const,
  },
} as const

/**
 * Fetch data quality statistics.
 * 
 * @param timeframe - Timeframe for the statistics: "week", "month", or "all"
 * @param force - Force regeneration of reports (default: false)
 * @returns Promise resolving to data quality stats
 */
export async function getDataQualityStats(
  timeframe: DataQualityTimeframe = "month",
  force: boolean = false
): Promise<DataQualityStats> {
  // Add cache-busting timestamp to ensure fresh data when needed
  const cacheBuster = Date.now()
  const params = new URLSearchParams({
    timeframe,
    ...(force ? { force: "true" } : {}),
    _: cacheBuster.toString(),
  })

  const response = await fetch(`/api/data-quality?${params}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(`Failed to fetch data quality stats: ${response.statusText}${errorText ? ` - ${errorText}` : ""}`)
  }

  const data: DataQualityStats = await response.json()

  return data
}

/**
 * Fetch all houses for data quality purposes (CSV export, etc.).
 * 
 * @returns Promise resolving to houses array
 */
export async function getDataQualityHouses(): Promise<any[]> {
  const response = await fetch("/api/data-quality-houses", {
    cache: "no-store", // Always fetch fresh data for data quality
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message ||
        errorData.error ||
        `Failed to fetch data quality houses: ${response.statusText}`)
  }

  const data = await response.json()

  // API returns array directly
  return Array.isArray(data) ? data : []
}

