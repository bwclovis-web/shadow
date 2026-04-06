import React from "react"
import { Line } from "react-chartjs-2"
import { useTranslations } from "next-intl"

interface TrendChartProps {
  trendChartData: {
    labels: string[]
    datasets: unknown[]
  }
  timeframe: "week" | "month" | "all"
}

const TrendChart: React.FC<TrendChartProps> = ({ trendChartData, timeframe }) => {
  const t = useTranslations("dataQuality.trends")
  const chartId = `trend-chart-${timeframe}`
  const hasSeries = trendChartData.datasets.length > 0 && trendChartData.labels.length > 0

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-8">
      <h3 className="text-lg font-medium text-gray-800 mb-4">{t("heading")}</h3>
      {hasSeries ? (
        <Line
          key={chartId}
          id={chartId}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: "top" as const,
              },
              title: {
                display: true,
                text: t("pluginTitle"),
              },
            },
          }}
          data={trendChartData as React.ComponentProps<typeof Line>["data"]}
        />
      ) : (
        <p className="text-sm text-gray-600 py-6">{t("empty")}</p>
      )}
    </div>
  )
}

export default TrendChart
