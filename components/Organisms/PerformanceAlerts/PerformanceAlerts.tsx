import React, { useCallback, useEffect, useState } from "react"

import { styleMerge } from "~/utils/styleUtils"

interface AlertRule {
  id: string
  name: string
  metric: string
  threshold: number
  operator: "gt" | "lt" | "gte" | "lte" | "eq"
  severity: "low" | "medium" | "high" | "critical"
  enabled: boolean
  description?: string
}

interface PerformanceAlert {
  id: string
  ruleId: string
  message: string
  severity: "low" | "medium" | "high" | "critical"
  timestamp: number
  resolved: boolean
  value: number
  threshold: number
}

interface PerformanceAlertsProps {
  enabled?: boolean
  showUI?: boolean
  className?: string
  maxAlerts?: number
  autoResolve?: boolean
  autoResolveDelay?: number
  customRules?: AlertRule[]
}

const defaultRules: AlertRule[] = [
  {
    id: "lcp-threshold",
    name: "LCP Threshold Exceeded",
    metric: "lcp",
    threshold: 2500,
    operator: "gt",
    severity: "high",
    enabled: true,
    description: "Largest Contentful Paint exceeds 2.5 seconds",
  },
  {
    id: "fid-threshold",
    name: "FID Threshold Exceeded",
    metric: "fid",
    threshold: 100,
    operator: "gt",
    severity: "high",
    enabled: true,
    description: "First Input Delay exceeds 100ms",
  },
  {
    id: "cls-threshold",
    name: "CLS Threshold Exceeded",
    metric: "cls",
    threshold: 0.1,
    operator: "gt",
    severity: "medium",
    enabled: true,
    description: "Cumulative Layout Shift exceeds 0.1",
  },
  {
    id: "fcp-threshold",
    name: "FCP Threshold Exceeded",
    metric: "fcp",
    threshold: 1800,
    operator: "gt",
    severity: "medium",
    enabled: true,
    description: "First Contentful Paint exceeds 1.8 seconds",
  },
  {
    id: "tti-threshold",
    name: "TTI Threshold Exceeded",
    metric: "tti",
    threshold: 3800,
    operator: "gt",
    severity: "high",
    enabled: true,
    description: "Time to Interactive exceeds 3.8 seconds",
  },
  {
    id: "resource-count",
    name: "High Resource Count",
    metric: "resourceCount",
    threshold: 50,
    operator: "gt",
    severity: "low",
    enabled: true,
    description: "Number of resources exceeds 50",
  },
  {
    id: "bundle-size",
    name: "Large Bundle Size",
    metric: "bundleSize",
    threshold: 2 * 1024 * 1024, // 2MB
    operator: "gt",
    severity: "medium",
    enabled: true,
    description: "Bundle size exceeds 2MB",
  },
  {
    id: "memory-usage",
    name: "High Memory Usage",
    metric: "memoryUsage",
    threshold: 0.8, // 80%
    operator: "gt",
    severity: "high",
    enabled: true,
    description: "Memory usage exceeds 80%",
  },
]

const PerformanceAlerts: React.FC<PerformanceAlertsProps> = ({
  enabled = process.env.NODE_ENV === "development",
  showUI = true,
  className = "",
  maxAlerts = 10,
  autoResolve = true,
  autoResolveDelay = 30000, // 30 seconds
  customRules = [],
}) => {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [rules, setRules] = useState<AlertRule[]>([...defaultRules, ...customRules])
  const [isMonitoring, setIsMonitoring] = useState(false)

  const checkRule = useCallback((rule: AlertRule, value: number): boolean => {
    switch (rule.operator) {
      case "gt":
        return value > rule.threshold
      case "lt":
        return value < rule.threshold
      case "gte":
        return value >= rule.threshold
      case "lte":
        return value <= rule.threshold
      case "eq":
        return value === rule.threshold
      default:
        return false
    }
  }, [])

  const createAlert = useCallback(
    (rule: AlertRule, value: number): PerformanceAlert => ({
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      message: `${rule.name}: ${value.toFixed(2)} ${rule.operator} ${
        rule.threshold
      }`,
      severity: rule.severity,
      timestamp: Date.now(),
      resolved: false,
      value,
      threshold: rule.threshold,
    }),
    []
  )

  const collectMetrics = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      return
    }

    const newAlerts: PerformanceAlert[] = []

    try {
      // Collect navigation timing
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming
      if (navigation) {
        const metrics = {
          lcp: navigation.loadEventEnd - navigation.navigationStart,
          fcp: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          tti: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          fid: 0, // FID requires user interaction
          cls: 0, // CLS requires layout shift observer
        }

        // Check each rule
        rules.forEach(rule => {
          if (!rule.enabled) {
            return
          }

          let value = 0
          switch (rule.metric) {
            case "lcp":
              value = metrics.lcp
              break
            case "fid":
              value = metrics.fid
              break
            case "cls":
              value = metrics.cls
              break
            case "fcp":
              value = metrics.fcp
              break
            case "tti":
              value = metrics.tti
              break
            case "resourceCount":
              value = performance.getEntriesByType("resource").length
              break
            case "bundleSize":
              value = performance
                .getEntriesByType("resource")
                .reduce((total, resource) => total + (resource.transferSize || 0), 0)
              break
            case "memoryUsage":
              if ((performance as any).memory) {
                value =
                  (performance as any).memory.usedJSHeapSize /
                  (performance as any).memory.jsHeapSizeLimit
              }
              break
          }

          if (checkRule(rule, value)) {
            // Check if alert already exists and is not resolved
            const existingAlert = alerts.find(alert => alert.ruleId === rule.id && !alert.resolved)

            if (!existingAlert) {
              newAlerts.push(createAlert(rule, value))
            }
          }
        })
      }

      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, maxAlerts))
      }
    } catch (error) {
      console.error("Error collecting performance metrics for alerts:", error)
    }
  }, [
enabled, rules, checkRule, createAlert, maxAlerts
])

  const resolveAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => alert.id === alertId ? { ...alert, resolved: true } : alert))
  }, [])

  const resolveAllAlerts = useCallback(() => {
    setAlerts(prev => prev.map(alert => ({ ...alert, resolved: true })))
  }, [])

  const clearResolvedAlerts = useCallback(() => {
    setAlerts(prev => prev.filter(alert => !alert.resolved))
  }, [])

  const toggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(rule => rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    setIsMonitoring(true)
    const interval = setInterval(collectMetrics, 5000) // Check every 5 seconds

    return () => {
      clearInterval(interval)
      setIsMonitoring(false)
    }
  }, [enabled])

  // Auto-resolve alerts
  useEffect(() => {
    if (!autoResolve) {
      return
    }

    const timer = setTimeout(() => {
      setAlerts(prev => prev.map(alert => Date.now() - alert.timestamp > autoResolveDelay
            ? { ...alert, resolved: true }
            : alert))
    }, autoResolveDelay)

    return () => clearTimeout(timer)
  }, [autoResolve, autoResolveDelay, alerts])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 border-red-300 text-red-800"
      case "high":
        return "bg-orange-100 border-orange-300 text-orange-800"
      case "medium":
        return "bg-yellow-100 border-yellow-300 text-yellow-800"
      case "low":
        return "bg-blue-100 border-blue-300 text-blue-800"
      default:
        return "bg-gray-100 border-gray-300 text-gray-800"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴"
      case "high":
        return "🟠"
      case "medium":
        return "🟡"
      case "low":
        return "🔵"
      default:
        return "⚪"
    }
  }

  const activeAlerts = alerts.filter(alert => !alert.resolved)
  const resolvedAlerts = alerts.filter(alert => alert.resolved)

  if (!enabled || !showUI) {
    return null
  }

  return (
    <div
      className={styleMerge(
        "bg-white border border-gray-200 rounded-lg shadow-lg p-6",
        className
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Performance Alerts</h2>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isMonitoring ? "bg-green-400 animate-pulse" : "bg-gray-400"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isMonitoring ? "Monitoring" : "Stopped"}
          </span>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 mb-1">Critical</div>
          <div className="text-2xl font-bold text-red-800">
            {activeAlerts.filter(alert => alert.severity === "critical").length}
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-orange-600 mb-1">High</div>
          <div className="text-2xl font-bold text-orange-800">
            {activeAlerts.filter(alert => alert.severity === "high").length}
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 mb-1">Medium</div>
          <div className="text-2xl font-bold text-yellow-800">
            {activeAlerts.filter(alert => alert.severity === "medium").length}
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 mb-1">Low</div>
          <div className="text-2xl font-bold text-blue-800">
            {activeAlerts.filter(alert => alert.severity === "low").length}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={resolveAllAlerts}
          className="px-3 py-1 bg-green-100 text-green-800 rounded-md text-sm hover:bg-green-200 transition-colors"
        >
          Resolve All
        </button>
        <button
          onClick={clearResolvedAlerts}
          className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md text-sm hover:bg-gray-200 transition-colors"
        >
          Clear Resolved
        </button>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Active Alerts ({activeAlerts.length})
          </h3>
          <div className="space-y-3">
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">
                      {getSeverityIcon(alert.severity)}
                    </span>
                    <div>
                      <div className="font-semibold">{alert.message}</div>
                      <div className="text-sm opacity-75">
                        {new Date(alert.timestamp).toLocaleString("en-US")}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="px-3 py-1 bg-white bg-opacity-50 rounded-md text-sm hover:bg-opacity-75 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Alerts */}
      {resolvedAlerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Resolved Alerts ({resolvedAlerts.length})
          </h3>
          <div className="space-y-2">
            {resolvedAlerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                className="p-3 rounded-lg border border-gray-200 bg-gray-50 opacity-75"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm">✅</span>
                    <div>
                      <div className="text-sm font-medium text-gray-600">
                        {alert.message}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString("en-US")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {resolvedAlerts.length > 5 && (
              <div className="text-sm text-gray-500 text-center">
                ... and {resolvedAlerts.length - 5} more resolved alerts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules Configuration */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Alert Rules</h3>
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`w-4 h-4 rounded border-2 ${
                    rule.enabled
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white border-gray-300"
                  }`}
                >
                  {rule.enabled && (
                    <div className="w-2 h-2 bg-white rounded-sm m-0.5" />
                  )}
                </button>
                <div>
                  <div className="font-medium text-gray-800">{rule.name}</div>
                  <div className="text-sm text-gray-600">{rule.description}</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {rule.threshold} {rule.operator}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PerformanceAlerts
