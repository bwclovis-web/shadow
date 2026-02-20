import React, { useCallback, useEffect, useState } from "react"

import type { CoreWebVitals, PerformanceMetrics } from "~/types/performance"
import { styleMerge } from "~/utils/styleUtils"

interface PerformanceDashboardProps {
  enabled?: boolean
  showUI?: boolean
  className?: string
  refreshInterval?: number
  thresholds?: {
    lcp: number
    fid: number
    cls: number
    fcp: number
    tti: number
  }
}

interface PerformanceData {
  webVitals: CoreWebVitals
  navigation: PerformanceMetrics
  resources: {
    count: number
    totalSize: number
    loadTime: number
  }
  memory?: {
    used: number
    total: number
    limit: number
  }
  timestamp: number
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  enabled = process.env.NODE_ENV === "development",
  showUI = true,
  className = "",
  refreshInterval = 5000,
  thresholds = {
    lcp: 2500,
    fid: 100,
    cls: 0.1,
    fcp: 1800,
    tti: 3800,
  },
}) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [isCollecting, setIsCollecting] = useState(false)
  const [alerts, setAlerts] = useState<string[]>([])

  const collectPerformanceData = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return
    }

    setIsCollecting(true)

    try {
      // Collect Core Web Vitals
      const webVitals: CoreWebVitals = {
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        tti: 0,
      }

      // Collect navigation timing
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming
      const navigationMetrics: PerformanceMetrics = {
        dns: navigation
          ? navigation.domainLookupEnd - navigation.domainLookupStart
          : 0,
        tcp: navigation ? navigation.connectEnd - navigation.connectStart : 0,
        ttfb: navigation ? navigation.responseStart - navigation.requestStart : 0,
        domContentLoaded: navigation
          ? navigation.domContentLoadedEventEnd - navigation.navigationStart
          : 0,
        loadComplete: navigation
          ? navigation.loadEventEnd - navigation.navigationStart
          : 0,
      }

      // Collect resource information
      const resources = performance.getEntriesByType("resource")
      const resourceMetrics = {
        count: resources.length,
        totalSize: resources.reduce(
          (total, resource) => total + (resource.transferSize || 0),
          0
        ),
        loadTime: resources.reduce(
          (total, resource) => total + resource.duration,
          0
        ),
      }

      // Collect memory information (if available)
      const memory = (performance as any).memory
        ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit,
          }
        : undefined

      const data: PerformanceData = {
        webVitals,
        navigation: navigationMetrics,
        resources: resourceMetrics,
        memory,
        timestamp: Date.now(),
      }

      setPerformanceData(data)

      // Check for performance alerts
      const newAlerts: string[] = []
      if (navigationMetrics.loadComplete > thresholds.lcp) {
        newAlerts.push(`Page load time (${navigationMetrics.loadComplete.toFixed(0)}ms) exceeds LCP threshold (${thresholds.lcp}ms)`)
      }
      if (resourceMetrics.count > 50) {
        newAlerts.push(`High resource count: ${resourceMetrics.count} resources loaded`)
      }
      if (resourceMetrics.totalSize > 2 * 1024 * 1024) {
        // 2MB
        newAlerts.push(`Large bundle size: ${(resourceMetrics.totalSize / 1024 / 1024).toFixed(1)}MB`)
      }

      setAlerts(newAlerts)
    } catch (error) {
      console.error("Error collecting performance data:", error)
    } finally {
      setIsCollecting(false)
    }
  }, [enabled, thresholds])

  useEffect(() => {
    if (!enabled) {
      return
    }

    // Initial collection
    collectPerformanceData()

    // Set up periodic collection
    const interval = setInterval(collectPerformanceData, refreshInterval)

    return () => clearInterval(interval)
  }, [enabled, refreshInterval])

  const getPerformanceScore = (
    value: number,
    threshold: number,
    reverse = false
  ) => {
    const ratio = reverse ? threshold / value : value / threshold
    if (ratio <= 0.5) {
      return "excellent"
    }
    if (ratio <= 0.75) {
      return "good"
    }
    if (ratio <= 1) {
      return "needs-improvement"
    }
    return "poor"
  }

  const getScoreColor = (score: string) => {
    switch (score) {
      case "excellent":
        return "text-green-600"
      case "good":
        return "text-blue-600"
      case "needs-improvement":
        return "text-yellow-600"
      case "poor":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {
      return "0 Bytes"
    }
    const k = 1024
    const sizes = [
"Bytes", "KB", "MB", "GB"
]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (!enabled || !showUI || !performanceData) {
    return null
  }

  return (
    <div
      className={styleMerge(
        "bg-white border border-gray-200 rounded-lg shadow-lg p-6 max-w-4xl",
        className
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Performance Dashboard</h2>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isCollecting ? "bg-yellow-400 animate-pulse" : "bg-green-400"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isCollecting ? "Collecting..." : "Live"}
          </span>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Core Web Vitals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">
              Largest Contentful Paint
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.navigation.loadComplete.toFixed(0)}ms
            </div>
            <div
              className={`text-sm ${getScoreColor(getPerformanceScore(
                  performanceData.navigation.loadComplete,
                  thresholds.lcp
                ))}`}
            >
              {getPerformanceScore(
                performanceData.navigation.loadComplete,
                thresholds.lcp
              ).replace("-", " ")}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Time to Interactive</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.navigation.domContentLoaded.toFixed(0)}ms
            </div>
            <div
              className={`text-sm ${getScoreColor(getPerformanceScore(
                  performanceData.navigation.domContentLoaded,
                  thresholds.tti
                ))}`}
            >
              {getPerformanceScore(
                performanceData.navigation.domContentLoaded,
                thresholds.tti
              ).replace("-", " ")}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">First Contentful Paint</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.navigation.domContentLoaded.toFixed(0)}ms
            </div>
            <div
              className={`text-sm ${getScoreColor(getPerformanceScore(
                  performanceData.navigation.domContentLoaded,
                  thresholds.fcp
                ))}`}
            >
              {getPerformanceScore(
                performanceData.navigation.domContentLoaded,
                thresholds.fcp
              ).replace("-", " ")}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Cumulative Layout Shift</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.webVitals.cls.toFixed(3)}
            </div>
            <div
              className={`text-sm ${getScoreColor(getPerformanceScore(
                  performanceData.webVitals.cls,
                  thresholds.cls,
                  true
                ))}`}
            >
              {getPerformanceScore(
                performanceData.webVitals.cls,
                thresholds.cls,
                true
              ).replace("-", " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Timing */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Navigation Timing
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">DNS Lookup</div>
            <div className="text-lg font-semibold text-gray-800">
              {performanceData.navigation.dns.toFixed(0)}ms
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">TCP Connect</div>
            <div className="text-lg font-semibold text-gray-800">
              {performanceData.navigation.tcp.toFixed(0)}ms
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">TTFB</div>
            <div className="text-lg font-semibold text-gray-800">
              {performanceData.navigation.ttfb.toFixed(0)}ms
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">DOM Ready</div>
            <div className="text-lg font-semibold text-gray-800">
              {performanceData.navigation.domContentLoaded.toFixed(0)}ms
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Load Complete</div>
            <div className="text-lg font-semibold text-gray-800">
              {performanceData.navigation.loadComplete.toFixed(0)}ms
            </div>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Resource Count</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.resources.count}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Total Size</div>
            <div className="text-2xl font-bold text-gray-800">
              {formatBytes(performanceData.resources.totalSize)}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Load Time</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.resources.loadTime.toFixed(0)}ms
            </div>
          </div>
        </div>
      </div>

      {/* Memory Usage */}
      {performanceData.memory && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Memory Usage</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Used Memory</span>
              <span className="text-sm font-semibold text-gray-800">
                {formatBytes(performanceData.memory.used)} /{" "}
                {formatBytes(performanceData.memory.limit)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    (performanceData.memory.used / performanceData.memory.limit) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Performance Alerts
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3" />
                  <span className="text-sm text-yellow-800">{alert}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="text-xs text-gray-500 text-center">
        Last updated: {new Date(performanceData.timestamp).toLocaleTimeString()}
      </div>
    </div>
  )
}

export default PerformanceDashboard
