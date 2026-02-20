export type DataQualityStats = {
  totalMissing: number
  totalDuplicates: number
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
  totalHousesNoPerfumes?: number
  housesNoPerfumes?: Array<{
    id: string
    name: string
    type: string
    createdAt: string
  }>
}

// Helper to generate breakdown for missing house info
export const getMissingHouseInfoBreakdown = 
  (stats: DataQualityStats | null): Record<string, string[]> => {
  if (!stats || !stats.missingHouseInfoByBrand) {
    return {}
  }
  // This assumes backend returns missingHouseInfoByBrand as { houseName: number }
  // For a more detailed breakdown, backend should return { houseName: [fields] }
  // For now, we infer missing fields by showing count as array of 'Field missing'
  return Object.fromEntries(Object.entries(stats.missingHouseInfoByBrand)
  .map(([house, count]) => [
      house,
      Array(count).fill("Field missing"),
    ]))
}

export const prepareMissingChartData = (stats: DataQualityStats | null) => ({
  labels: stats?.missingByBrand
    ? Object.keys(stats.missingByBrand).slice(0, 10)
    : [],
  datasets: [
    {
      label: "Missing Information",
      data: stats?.missingByBrand
        ? Object.values(stats.missingByBrand).slice(0, 10)
        : [],
      backgroundColor: "rgba(255, 99, 132, 0.5)",
      borderColor: "rgb(255, 99, 132)",
      borderWidth: 1,
    },
  ],
})

export const prepareMissingHouseInfoChartData = 
(stats: DataQualityStats | null): {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor: string
    borderColor: string
    borderWidth: number
  }[]
} => ({
  labels:
    stats && stats.missingHouseInfoByBrand
      ? Object.keys(stats.missingHouseInfoByBrand).slice(0, 10)
      : [],
  datasets: [
    {
      label: "Missing House Info",
      data:
        stats && stats.missingHouseInfoByBrand
          ? Object.values(stats.missingHouseInfoByBrand).slice(0, 10)
          : [],
      backgroundColor: "rgba(255, 206, 86, 0.5)",
      borderColor: "rgb(255, 206, 86)",
      borderWidth: 1,
    },
  ],
})

export const prepareDuplicateChartData = (stats: DataQualityStats | null) => ({
  labels: stats?.duplicatesByBrand
    ? Object.keys(stats.duplicatesByBrand).slice(0, 10)
    : [],
  datasets: [
    {
      label: "Duplicate Entries",
      data: stats?.duplicatesByBrand
        ? Object.values(stats.duplicatesByBrand).slice(0, 10)
        : [],
      backgroundColor: "rgba(53, 162, 235, 0.5)",
      borderColor: "rgb(53, 162, 235)",
      borderWidth: 1,
    },
  ],
})

export const prepareTrendChartData = (stats: DataQualityStats | null) => {
  if (!stats?.historyData) {
    return {
      labels: [],
      datasets: [],
    }
  }

  return {
    labels: stats.historyData.dates || [],
    datasets: [
      {
        label: "Missing Information",
        data: stats.historyData.missing || [],
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        tension: 0.1,
      },
      {
        label: "Duplicate Entries",
        data: stats.historyData.duplicates || [],
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.5)",
        tension: 0.1,
      },
    ],
  }
}

export const prepareAllChartData = (stats: DataQualityStats | null) => ({
  missingChartData: prepareMissingChartData(stats),
  duplicateChartData: prepareDuplicateChartData(stats),
  missingHouseInfoChartData: prepareMissingHouseInfoChartData(stats),
  trendChartData: prepareTrendChartData(stats),
  missingHouseInfoBreakdown: getMissingHouseInfoBreakdown(stats),
})
