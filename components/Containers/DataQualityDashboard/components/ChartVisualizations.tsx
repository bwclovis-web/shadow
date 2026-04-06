import type { ChartData, ChartOptions } from "chart.js"
import React from "react"
import { useTranslations } from "next-intl"
import { Bar } from "react-chartjs-2"

interface ChartVisualizationsProps {
  missingChartData: ChartData<"bar">
  duplicateChartData: ChartData<"bar">
  missingHouseInfoChartData: ChartData<"bar">
  chartOptions: ChartOptions<"bar">
  missingHouseInfoBreakdown?: Record<string, string[]>
  timeframe: "week" | "month" | "all"
}

const ChartVisualizations: React.FC<ChartVisualizationsProps> = ({
  missingChartData,
  duplicateChartData,
  missingHouseInfoChartData,
  chartOptions,
  missingHouseInfoBreakdown,
  timeframe,
}) => {
  const t = useTranslations("dataQuality.charts")
  const tf = useTranslations("dataQuality.fieldLabels")

  const missingChartId = `missing-data-chart-${timeframe}`
  const duplicatesChartId = `duplicates-chart-${timeframe}`
  const houseInfoChartId = `missing-house-info-chart-${timeframe}`

  const formatFields = (fields: string[]) =>
    fields
      .map(f => {
        if (f === "unknown") return "-"
        if (f === "description" || f === "website" || f === "email") return tf(f)
        return f
      })
      .join(", ")

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-800 mb-4">{t("topBrandsMissing")}</h3>
        <Bar
          key={missingChartId}
          id={missingChartId}
          options={{ ...chartOptions, maintainAspectRatio: true }}
          data={missingChartData}
        />
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-800 mb-4">{t("topBrandsDuplicates")}</h3>
        <Bar
          key={duplicatesChartId}
          id={duplicatesChartId}
          options={{ ...chartOptions, maintainAspectRatio: true }}
          data={duplicateChartData}
        />
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-800 mb-4">{t("topHousesMissingInfo")}</h3>
        <Bar
          key={houseInfoChartId}
          id={houseInfoChartId}
          options={{ ...chartOptions, maintainAspectRatio: true }}
          data={missingHouseInfoChartData}
        />
        {missingHouseInfoBreakdown && Object.keys(missingHouseInfoBreakdown).length > 0 && (
          <div className="mt-6">
            <h4 className="text-md font-semibold text-yellow-800 mb-2">{t("breakdownTitle")}</h4>
            <table className="min-w-full text-sm border border-yellow-200 rounded">
              <thead>
                <tr className="bg-yellow-50">
                  <th className="px-2 py-1 text-left text-yellow-900">{t("houseColumn")}</th>
                  <th className="px-2 py-1 text-left text-yellow-900">{t("missingFieldsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(missingHouseInfoBreakdown).map(([house, fields]) => (
                  <tr key={house} className="border-t border-yellow-100">
                    <td className="px-2 py-1 text-yellow-900">{house}</td>
                    <td className="px-2 py-1 text-yellow-700">{formatFields(fields)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChartVisualizations
