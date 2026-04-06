import type { DataQualityStats } from "@/lib/queries/dataQuality"

export type { DataQualityStats }

export type ChartDatasetLabels = {
  missingInformation: string
  duplicateEntries: string
  missingHouseInfo: string
}

const defaultChartLabels: ChartDatasetLabels = {
  missingInformation: "Missing Information",
  duplicateEntries: "Duplicate Entries",
  missingHouseInfo: "Missing House Info",
}

export const getMissingHouseInfoBreakdown = (
  stats: DataQualityStats | null
): Record<string, string[]> => {
  if (!stats) return {}
  if (stats.housesWithMissingHouseInfo?.length) {
    return Object.fromEntries(stats.housesWithMissingHouseInfo.map(h => [h.name, h.missingFields]))
  }
  if (!stats.missingHouseInfoByBrand) return {}
  return Object.fromEntries(
    Object.entries(stats.missingHouseInfoByBrand).map(([house, count]) => [
      house,
      Array(count).fill("unknown"),
    ])
  )
}

export const prepareMissingChartData = (
  stats: DataQualityStats | null,
  labels: ChartDatasetLabels = defaultChartLabels
) => ({
  labels: stats?.missingByBrand ? Object.keys(stats.missingByBrand).slice(0, 10) : [],
  datasets: [
    {
      label: labels.missingInformation,
      data: stats?.missingByBrand ? Object.values(stats.missingByBrand).slice(0, 10) : [],
      backgroundColor: "rgba(255, 99, 132, 0.5)",
      borderColor: "rgb(255, 99, 132)",
      borderWidth: 1,
    },
  ],
})

export const prepareMissingHouseInfoChartData = (
  stats: DataQualityStats | null,
  labels: ChartDatasetLabels = defaultChartLabels
): {
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
    stats && stats.missingHouseInfoByBrand ? Object.keys(stats.missingHouseInfoByBrand).slice(0, 10) : [],
  datasets: [
    {
      label: labels.missingHouseInfo,
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

export const prepareDuplicateChartData = (
  stats: DataQualityStats | null,
  labels: ChartDatasetLabels = defaultChartLabels
) => ({
  labels: stats?.duplicatesByBrand ? Object.keys(stats.duplicatesByBrand).slice(0, 10) : [],
  datasets: [
    {
      label: labels.duplicateEntries,
      data: stats?.duplicatesByBrand ? Object.values(stats.duplicatesByBrand).slice(0, 10) : [],
      backgroundColor: "rgba(53, 162, 235, 0.5)",
      borderColor: "rgb(53, 162, 235)",
      borderWidth: 1,
    },
  ],
})

export const prepareTrendChartData = (
  stats: DataQualityStats | null,
  labels: ChartDatasetLabels = defaultChartLabels
) => {
  if (!stats?.historyData?.dates?.length) {
    return {
      labels: [] as string[],
      datasets: [] as {
        label: string
        data: number[]
        borderColor: string
        backgroundColor: string
        tension: number
      }[],
    }
  }

  return {
    labels: stats.historyData.dates || [],
    datasets: [
      {
        label: labels.missingInformation,
        data: stats.historyData.missing || [],
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        tension: 0.1,
      },
      {
        label: labels.duplicateEntries,
        data: stats.historyData.duplicates || [],
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.5)",
        tension: 0.1,
      },
    ],
  }
}

export const prepareAllChartData = (
  stats: DataQualityStats | null,
  labels: ChartDatasetLabels = defaultChartLabels
) => ({
  missingChartData: prepareMissingChartData(stats, labels),
  duplicateChartData: prepareDuplicateChartData(stats, labels),
  missingHouseInfoChartData: prepareMissingHouseInfoChartData(stats, labels),
  trendChartData: prepareTrendChartData(stats, labels),
  missingHouseInfoBreakdown: getMissingHouseInfoBreakdown(stats),
})
