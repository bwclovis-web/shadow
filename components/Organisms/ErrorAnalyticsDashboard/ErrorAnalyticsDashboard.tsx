/**
 * Error Analytics Dashboard
 *
 * Displays comprehensive error analytics with charts and statistics.
 * Provides insights into error patterns, trends, and affected users.
 */

import React, { useState } from "react"
import { useFetcher } from "react-router"

import type { ErrorAnalyticsReport } from "~/utils/errorAnalytics.server"

export interface ErrorAnalyticsDashboardProps {
  initialData?: ErrorAnalyticsReport
}

type TimeRange = "hour" | "day" | "week" | "month" | "all"

export function ErrorAnalyticsDashboard({
  initialData,
}: ErrorAnalyticsDashboardProps) {
  const fetcher = useFetcher<{
    success: boolean
    data: ErrorAnalyticsReport
  }>()
  const [timeRange, setTimeRange] = useState<TimeRange>("day")

  const data = fetcher.data?.data || initialData
  const isLoading = fetcher.state === "loading"

  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange)
    fetcher.load(`/api/error-analytics?timeRange=${newRange}`)
  }

  const handleExport = () => {
    window.open(
      `/api/error-analytics?timeRange=${timeRange}&format=export`,
      "_blank"
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Loading error analytics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Error Analytics</h1>
          <p className="text-gray-500 mt-1">
            {new Date(data.startTime).toLocaleDateString("en-US")} -{" "}
            {new Date(data.endTime).toLocaleDateString("en-US")}
          </p>
        </div>

        <div className="flex gap-4">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={e => handleTimeRangeChange(e.target.value as TimeRange)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-noir-black"
            disabled={isLoading}
          >
            <option value="hour">Last Hour</option>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="all">All Time</option>
          </select>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-noir-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Export Data
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Errors"
          value={data.totalErrors}
          icon="🔴"
          trend={
            data.errorRate > 0 ? `${data.errorRate.toFixed(2)}/hr` : "No errors"
          }
        />
        <MetricCard
          title="Critical Errors"
          value={data.criticalErrors}
          icon="🚨"
          color="red"
        />
        <MetricCard
          title="High Priority"
          value={data.highErrors}
          icon="⚠️"
          color="orange"
        />
        <MetricCard title="Affected Users" value={data.affectedUsers} icon="👥" />
      </div>

      {/* Error Severity Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Error Severity Breakdown
        </h2>
        <div className="space-y-3">
          {data.errorsBySeverity.map(item => (
            <div key={item.severity} className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-gray-700">
                {item.severity}
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden">
                <div
                  className={`h-full flex items-center justify-end px-3 text-white text-sm font-medium ${getSeverityColor(item.severity)}`}
                  style={{ width: `${item.percentage}%` }}
                >
                  {item.count > 0 &&
                    `${item.count} (${item.percentage.toFixed(1)}%)`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Type Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Error Type Breakdown
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Percentage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Occurrence
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.errorsByType.map(item => (
                <tr key={item.type}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.percentage.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.lastOccurrence).toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Errors */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Top Errors by Frequency
        </h2>
        <div className="space-y-3">
          {data.topErrors.map((error, index) => (
            <div
              key={error.code}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-noir-black text-white rounded-full flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{error.code}</p>
                  <span className="text-sm font-semibold text-gray-600">
                    {error.count} occurrence{error.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{error.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Last: {new Date(error.lastOccurrence).toLocaleString("en-US")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Most Affected Users */}
      {data.mostAffectedUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Most Affected Users
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.mostAffectedUsers.map(user => (
                  <tr key={user.userId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.userId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.errorCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hourly Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Hourly Error Trend
        </h2>
        <div className="space-y-2">
          {data.hourlyTrend.slice(-24).map(trend => (
            <div key={trend.period} className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-600">
                {new Date(trend.period).toLocaleTimeString()}
              </div>
              <div className="flex-1 bg-gray-200 rounded h-6 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-end px-2 text-white text-xs font-medium"
                  style={{
                    width: `${Math.min(
                      (trend.totalErrors /
                        Math.max(...data.hourlyTrend.map(t => t.totalErrors), 1)) *
                        100,
                      100
                    )}%`,
                  }}
                >
                  {trend.totalErrors > 0 && trend.totalErrors}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Correlation IDs */}
      {data.recentCorrelationIds.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Correlation IDs
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.recentCorrelationIds.map(id => (
              <code
                key={id}
                className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm font-mono"
              >
                {id}
              </code>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Use these correlation IDs to trace errors across multiple services and
            requests.
          </p>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <p className="text-gray-900 font-medium">Loading analytics...</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper Components

interface MetricCardProps {
  title: string
  value: number
  icon: string
  trend?: string
  color?: "red" | "orange" | "blue" | "green"
}

function MetricCard({ title, value, icon, trend, color }: MetricCardProps) {
  const colorClasses = {
    red: "from-red-500 to-red-600",
    orange: "from-orange-500 to-orange-600",
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
  }

  const bgGradient = color ? colorClasses[color] : "from-gray-700 to-gray-800"

  return (
    <div
      className={`bg-gradient-to-br ${bgGradient} rounded-lg shadow p-6 text-white`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-90">{title}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold mb-1">{value.toLocaleString("en-US")}</p>
      {trend && <p className="text-sm opacity-75">{trend}</p>}
    </div>
  )
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-600",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-blue-500",
  }
  return colors[severity] || "bg-gray-500"
}
