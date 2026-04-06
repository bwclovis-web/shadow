import { type Dispatch, type FC, type SetStateAction } from "react"
import { useTranslations } from "next-intl"

import { createChartConfig } from "../utils/chartConfig"
import { prepareAllChartData } from "../utils/chartDataUtils"
import type { DataQualityStats } from "@/lib/queries/dataQuality"
import ChartVisualizations from "./ChartVisualizations"
import HousesWithNoPerfumes from "./HousesWithNoPerfumes"
import SummaryStats from "./SummaryStats"
import TimeframeSelector from "./TimeframeSelector"
import TrendChart from "./TrendChart"

interface DashboardContentProps {
  stats: DataQualityStats
  timeframe: "week" | "month" | "all"
  setTimeframe: Dispatch<SetStateAction<"week" | "month" | "all">>
  isFetching?: boolean
}

const DashboardContent: FC<DashboardContentProps> = ({
  stats,
  timeframe,
  setTimeframe,
  isFetching = false,
}) => {
  const t = useTranslations("dataQuality")

  const chartOptions = createChartConfig(t("charts.pluginTitle"))
  const chartData = prepareAllChartData(stats, {
    missingInformation: t("datasetLabels.missingInformation"),
    duplicateEntries: t("datasetLabels.duplicateEntries"),
    missingHouseInfo: t("datasetLabels.missingHouseInfo"),
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("dashboardTitle")}</h2>

      <TimeframeSelector
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        isFetching={isFetching}
        timePeriodLabel={t("timePeriod")}
        refreshingLabel={t("refreshing")}
        lastWeekLabel={t("timeframes.week")}
        lastMonthLabel={t("timeframes.month")}
        allTimeLabel={t("timeframes.all")}
      />

      <SummaryStats stats={stats} />

      <ChartVisualizations
        missingChartData={chartData.missingChartData}
        duplicateChartData={chartData.duplicateChartData}
        missingHouseInfoChartData={chartData.missingHouseInfoChartData}
        chartOptions={chartOptions}
        missingHouseInfoBreakdown={chartData.missingHouseInfoBreakdown}
        timeframe={timeframe}
      />

      <TrendChart trendChartData={chartData.trendChartData} timeframe={timeframe} />

      <HousesWithNoPerfumes stats={stats} />

      <div className="mt-8 text-right text-sm text-gray-500">
        {t("lastUpdatedLabel")} {stats.lastUpdated}
      </div>
    </div>
  )
}

export default DashboardContent
