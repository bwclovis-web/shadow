/**
 * Query functions and query keys for Data Quality
 */

export type DataQualityTimeframe = "week" | "month" | "all"

export interface DataQualityHouseRow {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  website: string | null
  country: string | null
  founded: string | null
  type: string
  email: string | null
  phone: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}

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
    slug: string
    type: string
    createdAt: string
  }>
  /** Houses missing description, website, or email (canonical rules in lib/data-quality/rules). */
  housesWithMissingHouseInfo?: Array<{
    id: string
    name: string
    slug: string
    type: string
    missingFields: string[]
  }>
}

export const queryKeys = {
  dataQuality: {
    all: ["dataQuality"] as const,
    stats: (timeframe: DataQualityTimeframe, force?: boolean) =>
      [...queryKeys.dataQuality.all, "stats", timeframe, force] as const,
    houses: () => [...queryKeys.dataQuality.all, "houses"] as const,
  },
} as const

export const getDataQualityStats = async (
  timeframe: DataQualityTimeframe = "month",
  force: boolean = false
): Promise<DataQualityStats> => {
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
    throw new Error(
      `Failed to fetch data quality stats: ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
    )
  }

  return (await response.json()) as DataQualityStats
}

export const getDataQualityHouses = async (): Promise<DataQualityHouseRow[]> => {
  const response = await fetch("/api/data-quality-houses", {
    cache: "no-store",
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string }
    throw new Error(
      errorData.message || errorData.error || `Failed to fetch data quality houses: ${response.statusText}`
    )
  }

  const data: unknown = await response.json()
  return Array.isArray(data) ? (data as DataQualityHouseRow[]) : []
}
