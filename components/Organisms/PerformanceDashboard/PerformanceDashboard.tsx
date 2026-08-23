"use client"

import { useCallback, useEffect, useState } from "react"

import type { CoreWebVitals, PerformanceMetrics } from "@/types/performance"
import { styleMerge } from "@/utils/styleUtils"

export interface PerformanceDashboardProps {
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

/** Stable default — inline `thresholds = { ... }` in props would be a new object every render and retrigger effects. */
const DEFAULT_THRESHOLDS: NonNullable<PerformanceDashboardProps["thresholds"]> = {
  lcp: 2500,
  fid: 100,
  cls: 0.1,
  fcp: 1800,
  tti: 3800,
}

const PerformanceDashboard = ({
  enabled = process.env.NODE_ENV === "development",
  showUI = true,
  className = "",
  refreshInterval = 5000,
  thresholds = DEFAULT_THRESHOLDS,
}: PerformanceDashboardProps) => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [isCollecting, setIsCollecting] = useState(false)
  const [alerts, setAlerts] = useState<string[]>([])

  const collectPerformanceData = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return
    }

    setIsCollecting(true)

    try {
      const webVitals: CoreWebVitals = {
        lcp: 0,
        fid: 0,
        inp: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0,
        tti: 0,
      }

      // Paint timing → FCP
      const paints = performance.getEntriesByType("paint") as PerformancePaintTiming[]
      const fcpEntry = paints.find(e => e.name === "first-contentful-paint")
      if (fcpEntry) webVitals.fcp = fcpEntry.startTime

      // LCP from PerformanceObserver buffer
      const lcpEntries = performance.getEntriesByType(
        "largest-contentful-paint"
      ) as PerformanceEntry[]
      if (lcpEntries.length > 0) {
        const last = lcpEntries[lcpEntries.length - 1] as PerformanceEntry & {
          startTime: number
        }
        webVitals.lcp = last.startTime
      }

      // CLS from layout-shift entries
      const shifts = performance.getEntriesByType("layout-shift") as Array<
        PerformanceEntry & { value: number; hadRecentInput?: boolean }
      >
      webVitals.cls = shifts
        .filter(s => !s.hadRecentInput)
        .reduce((sum, s) => sum + (s.value || 0), 0)

      // INP / FID from event / first-input
      const firstInputs = performance.getEntriesByType("first-input") as Array<
        PerformanceEntry & { processingStart: number; startTime: number }
      >
      if (firstInputs[0]) {
        webVitals.fid = firstInputs[0].processingStart - firstInputs[0].startTime
      }
      const eventEntries = performance.getEntriesByType("event") as Array<
        PerformanceEntry & { duration: number; name?: string }
      >
      if (eventEntries.length > 0) {
        const durations = eventEntries.map(e => e.duration).sort((a, b) => a - b)
        // Approximate INP as high-percentile interaction duration
        const idx = Math.min(
          durations.length - 1,
          Math.floor(durations.length * 0.98)
        )
        webVitals.inp = durations[idx] ?? 0
      }

      type NavTiming = PerformanceEntry & {
        domainLookupStart: number
        domainLookupEnd: number
        connectStart: number
        connectEnd: number
        requestStart: number
        responseStart: number
        navigationStart: number
        domContentLoadedEventEnd: number
        loadEventEnd: number
        domInteractive?: number
      }
      const navEntry = performance.getEntriesByType("navigation")[0] as NavTiming | undefined
      const navigationMetrics: PerformanceMetrics = {
        dns: navEntry ? navEntry.domainLookupEnd - navEntry.domainLookupStart : 0,
        tcp: navEntry ? navEntry.connectEnd - navEntry.connectStart : 0,
        ttfb: navEntry ? navEntry.responseStart - navEntry.requestStart : 0,
        domContentLoaded: navEntry
          ? navEntry.domContentLoadedEventEnd - navEntry.navigationStart
          : 0,
        loadComplete: navEntry
          ? navEntry.loadEventEnd - navEntry.navigationStart
          : 0,
      }
      webVitals.ttfb = navigationMetrics.ttfb
      if (navEntry?.domInteractive != null) {
        webVitals.tti = navEntry.domInteractive - navEntry.navigationStart
      }

      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      const resourceMetrics = {
        count: resources.length,
        totalSize: resources.reduce(
          (total, resource) => total + (resource.transferSize ?? 0),
          0
        ),
        loadTime: resources.reduce(
          (total, resource) => total + resource.duration,
          0
        ),
      }

      const perfMemory = (
        performance as Performance & {
          memory?: {
            usedJSHeapSize: number
            totalJSHeapSize: number
            jsHeapSizeLimit: number
          }
        }
      ).memory
      const memory = perfMemory
        ? {
            used: perfMemory.usedJSHeapSize,
            total: perfMemory.totalJSHeapSize,
            limit: perfMemory.jsHeapSizeLimit,
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

      const newAlerts: string[] = []
      if (webVitals.lcp > 0 && webVitals.lcp > thresholds.lcp) {
        newAlerts.push(
          `LCP (${webVitals.lcp.toFixed(0)}ms) exceeds threshold (${thresholds.lcp}ms)`
        )
      }

      // Track LCP samples for a rolling week; alert if p75 stays above 2.5s
      if (webVitals.lcp > 0 && typeof window !== "undefined") {
        try {
          const key = "perf-lcp-week"
          const weekMs = 7 * 24 * 60 * 60 * 1000
          const now = Date.now()
          const prev = JSON.parse(window.localStorage.getItem(key) ?? "[]") as Array<{
            t: number
            lcp: number
          }>
          const next = [
            ...prev.filter((s) => now - s.t < weekMs),
            { t: now, lcp: webVitals.lcp },
          ].slice(-200)
          window.localStorage.setItem(key, JSON.stringify(next))
          if (next.length >= 8) {
            const sorted = [...next].map((s) => s.lcp).sort((a, b) => a - b)
            const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0
            if (p75 > thresholds.lcp) {
              newAlerts.push(
                `LCP p75 over the last week (${p75.toFixed(0)}ms) exceeds ${thresholds.lcp}ms`
              )
            }
          }
        } catch {
          /* ignore storage errors */
        }
      }

      if (webVitals.cls > thresholds.cls) {
        newAlerts.push(
          `CLS (${webVitals.cls.toFixed(3)}) exceeds threshold (${thresholds.cls})`
        )
      }
      if (webVitals.inp > 0 && webVitals.inp > thresholds.fid) {
        newAlerts.push(
          `INP (${webVitals.inp.toFixed(0)}ms) exceeds threshold (${thresholds.fid}ms)`
        )
      }
      if (webVitals.fcp > 0 && webVitals.fcp > thresholds.fcp) {
        newAlerts.push(
          `FCP (${webVitals.fcp.toFixed(0)}ms) exceeds threshold (${thresholds.fcp}ms)`
        )
      }
      if (resourceMetrics.count > 50) {
        newAlerts.push(`High resource count: ${resourceMetrics.count} resources loaded`)
      }
      if (resourceMetrics.totalSize > 2 * 1024 * 1024) {
        newAlerts.push(
          `Large bundle size: ${(resourceMetrics.totalSize / 1024 / 1024).toFixed(1)}MB`
        )
      }

      setAlerts(newAlerts)
    } catch (error) {
      console.error("Error collecting performance data:", error)
    } finally {
      setIsCollecting(false)
    }
  }, [enabled, thresholds])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    let lcpObserver: PerformanceObserver | undefined
    let clsObserver: PerformanceObserver | undefined
    let inpObserver: PerformanceObserver | undefined

    try {
      lcpObserver = new PerformanceObserver(() => {
        collectPerformanceData()
      })
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true })
    } catch {
      /* unsupported */
    }

    try {
      clsObserver = new PerformanceObserver(() => {
        collectPerformanceData()
      })
      clsObserver.observe({ type: "layout-shift", buffered: true })
    } catch {
      /* unsupported */
    }

    try {
      inpObserver = new PerformanceObserver(() => {
        collectPerformanceData()
      })
      inpObserver.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
    } catch {
      /* unsupported */
    }

    return () => {
      lcpObserver?.disconnect()
      clsObserver?.disconnect()
      inpObserver?.disconnect()
    }
  }, [enabled, collectPerformanceData])

  useEffect(() => {
    if (!enabled) {
      return
    }

    collectPerformanceData()
    const interval = setInterval(collectPerformanceData, refreshInterval)
    return () => clearInterval(interval)
  }, [enabled, refreshInterval, collectPerformanceData])

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">
              Largest Contentful Paint
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.webVitals.lcp.toFixed(0)}ms
            </div>
            <div
              className={`text-sm ${getScoreColor(getPerformanceScore(
                  performanceData.webVitals.lcp,
                  thresholds.lcp
                ))}`}
            >
              {getPerformanceScore(
                performanceData.webVitals.lcp,
                thresholds.lcp
              ).replace("-", " ")}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">INP</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.webVitals.inp.toFixed(0)}ms
            </div>
            <div
              className={`text-sm ${getScoreColor(getPerformanceScore(
                  performanceData.webVitals.inp || performanceData.webVitals.fid,
                  thresholds.fid
                ))}`}
            >
              {getPerformanceScore(
                performanceData.webVitals.inp || performanceData.webVitals.fid,
                thresholds.fid
              ).replace("-", " ")}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">First Contentful Paint</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.webVitals.fcp.toFixed(0)}ms
            </div>
            <div
              className={`text-sm ${getScoreColor(getPerformanceScore(
                  performanceData.webVitals.fcp,
                  thresholds.fcp
                ))}`}
            >
              {getPerformanceScore(
                performanceData.webVitals.fcp,
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

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">TTFB</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.webVitals.ttfb.toFixed(0)}ms
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">DOM Interactive</div>
            <div className="text-2xl font-bold text-gray-800">
              {performanceData.webVitals.tti.toFixed(0)}ms
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
