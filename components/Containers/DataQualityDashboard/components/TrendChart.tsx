import React from "react"
import { Line } from "react-chartjs-2"

interface TrendChartProps {
  trendChartData: any
  timeframe: "week" | "month" | "all"
}

const TrendChart: React.FC<TrendChartProps> = ({ trendChartData, timeframe }) => {
  const chartId = `trend-chart-${timeframe}`

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-8">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Data Quality Trends</h3>
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
              text: "Quality Trends Over Time",
            },
          },
        }}
        data={trendChartData}
      />
    </div>
  )
}

export default TrendChart
