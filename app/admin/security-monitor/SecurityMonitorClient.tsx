"use client"

import { useEffect, useState } from "react"
import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type {
  AuditStats,
  RateLimitStats,
  SecurityStats,
} from "@/app/admin/types/security-stats"

const BANNER_IMAGE = "/images/security.webp"

interface SecurityMonitorClientProps {
  security: SecurityStats
  rateLimit: RateLimitStats
  audit: AuditStats
}

const StatCard = ({
  label,
  value,
  icon,
  borderColor,
  valueClassName,
}: {
  label: string
  value: number | string
  icon: string
  borderColor: string
  valueClassName?: string
}) => (
  <div
    className={`bg-noir-light/20 rounded-lg shadow p-6 border-l-4 ${borderColor}`}
  >
    <div className="flex items-center">
      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100">
        <span className="text-sm font-bold">{icon}</span>
      </div>
      <div className="ml-4">
        <h3 className="text-base font-semibold text-gray-900">{label}</h3>
        <p className={`text-3xl font-bold ${valueClassName ?? "text-gray-900"}`}>
          {String(value)}
        </p>
      </div>
    </div>
  </div>
)

const SecurityMonitorClient = ({
  security,
  rateLimit,
  audit,
}: SecurityMonitorClientProps) => {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const t = useTranslations("securityMonitor")

  useEffect(() => {
    setLastRefresh(new Date())
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true)
      setTimeout(() => {
        setIsRefreshing(false)
        setLastRefresh(new Date())
      }, 1000)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const lastRefreshDisplay = lastRefresh ?? new Date(0)
  const hasRecentEvents =
    security.recentEvents?.length > 0 && Array.isArray(security.recentEvents)

  return (
    <div className="min-h-screen">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <span className="text-sm text-noir-gold">
              Last updated: {lastRefreshDisplay.toLocaleTimeString("en-US")}
            </span>
            <Button
              onClick={() => window.location.reload()}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Security Events Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Security Events"
            value={security.totalEvents ?? 0}
            icon="🚨"
            borderColor="border-red-500"
            valueClassName="text-noir-gold"
          />
          <StatCard
            label="Active Alerts"
            value={security.activeAlerts ?? 0}
            icon="⚠️"
            borderColor="border-orange-500"
            valueClassName="text-orange-600"
          />
          <StatCard
            label="Unique IPs"
            value={security.uniqueIPs ?? 0}
            icon="🌐"
            borderColor="border-blue-500"
            valueClassName="text-blue-600"
          />
          <StatCard
            label="Suspicious IPs"
            value={security.suspiciousIPs ?? 0}
            icon="👁️"
            borderColor="border-yellow-500"
            valueClassName="text-yellow-600"
          />
        </div>

        {/* Rate Limiting Stats */}
        <div className="bg-noir-light/20 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Rate Limiting Statistics
            </h2>
            <span className="text-sm text-gray-500">
              {(rateLimit.totalViolations ?? 0) > 0
                ? "⚠️ Violations detected"
                : "✅ No violations"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Total Violations
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {String(rateLimit.totalViolations ?? 0)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Unique IPs
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {String(rateLimit.uniqueIPs ?? 0)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Recent Violations
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {String(rateLimit.recentViolations?.length ?? 0)}
              </p>
            </div>
          </div>
          {rateLimit.violationsByPath &&
            Object.keys(rateLimit.violationsByPath).length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Violations by Path
                </h3>
                <div className="space-y-2">
                  {Object.entries(rateLimit.violationsByPath).map(
                    ([path, count]) => (
                      <div
                        key={path}
                        className="flex justify-between items-center p-3 bg-red-50 rounded-lg"
                      >
                        <span className="text-sm font-medium text-gray-700">
                          {path}
                        </span>
                        <span className="text-sm font-bold text-red-600">
                          {String(count)} violations
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Audit Logs Stats */}
        <div className="bg-noir-light/20 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Audit Logs Statistics
            </h2>
            <Link
              href="/admin/audit-stats"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View raw JSON →
            </Link>
          </div>
          {(audit?.totalLogs ?? 0) === 0 &&
            (audit?.recentLogs?.length ?? 0) === 0 && (
              <p className="text-sm text-gray-500 mb-4">
                No audit backend connected yet. Stats below show placeholders.
                Implement{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  getAuditStats()
                </code>{" "}
                in{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  utils/security/audit-logger.server.ts
                </code>{" "}
                to see real data.
              </p>
            )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Total Logs
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {String(audit?.totalLogs ?? 0)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Unique Users
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {String(audit?.uniqueUsers ?? 0)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Unique IPs
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {String(audit?.uniqueIPs ?? 0)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Recent Logs
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {String(audit?.recentLogs?.length ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Security Events */}
        {hasRecentEvents ? (
          <div className="bg-noir-light/20 rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Recent Security Events
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {security.recentEvents.slice(0, 10).map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.timestamp
                          ? new Date(event.timestamp).toLocaleString("en-US")
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {event.type ?? "Unknown"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {event.ipAddress ?? "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {event.path ?? "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            event.severity === "high"
                              ? "bg-red-100 text-red-800"
                              : event.severity === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {event.severity ?? "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-noir-light/20 rounded-lg shadow p-6 mb-8 text-center">
            <div className="text-6xl mb-4">🛡️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Recent Security Events
            </h2>
            <p className="text-gray-600">
              Your application is secure! No security events have been detected
              recently.
            </p>
          </div>
        )}

        {/* Quick Actions & Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-noir-light/20 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Link
                href="/admin/rate-limit-stats"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-left px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                View Rate Limit Stats (JSON)
              </Link>
              <Link
                href="/admin/security-stats"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-left px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                View Security Stats (JSON)
              </Link>
              <Link
                href="/admin/audit-stats"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-left px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
              >
                View Audit Stats (JSON)
              </Link>
            </div>
          </div>
          <div className="bg-noir-light/20 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System Status
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rate Limiting</span>
                <span className="text-sm font-medium text-green-600">
                  ✅ Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">CSRF Protection</span>
                <span className="text-sm font-medium text-green-600">
                  ✅ Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Security Headers</span>
                <span className="text-sm font-medium text-green-600">
                  ✅ Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Audit Logging</span>
                <span className="text-sm font-medium text-green-600">
                  ✅ Active
                </span>
              </div>
            </div>
          </div>
          <div className="bg-noir-light/20 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Monitoring Info
            </h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• Auto-refresh every 30 seconds</p>
              <p>• Data retention: 7 days</p>
              <p>• Alert threshold: 5 violations/15min</p>
              <p>• IP blocking: 10+ violations/15min</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { SecurityMonitorClient }
