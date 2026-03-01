"use client"

import { useState } from "react"

import VooDooCheck from "@/components/Atoms/VooDooCheck/VooDooCheck"
import { ConditionalPerformanceLoader } from "@/components/Performance"

interface PerformanceSettings {
  monitoring: {
    enabled: boolean
    refreshInterval: number
    autoStart: boolean
  }
  alerts: {
    enabled: boolean
    autoResolve: boolean
    autoResolveDelay: number
    maxAlerts: number
  }
  optimization: {
    enabled: boolean
    autoOptimize: boolean
    customRules: boolean
  }
  tracing: {
    enabled: boolean
    maxEvents: number
    categories: string[]
  }
  thresholds: {
    lcp: number
    fid: number
    cls: number
    fcp: number
    tti: number
  }
}

const DEFAULT_SETTINGS: PerformanceSettings = {
  monitoring: {
    enabled: true,
    refreshInterval: 5000,
    autoStart: true,
  },
  alerts: {
    enabled: true,
    autoResolve: true,
    autoResolveDelay: 30000,
    maxAlerts: 50,
  },
  optimization: {
    enabled: true,
    autoOptimize: false,
    customRules: false,
  },
  tracing: {
    enabled: true,
    maxEvents: 1000,
    categories: ["navigation", "resource", "paint", "measure", "mark"],
  },
  thresholds: {
    lcp: 2500,
    fid: 100,
    cls: 0.1,
    fcp: 1800,
    tti: 3800,
  },
}

const TABS = [
  { id: "overview" as const, name: "Overview", icon: "📊" },
  { id: "dashboard" as const, name: "Dashboard", icon: "📈" },
  { id: "alerts" as const, name: "Alerts", icon: "🚨" },
  { id: "optimizer" as const, name: "Optimizer", icon: "⚡" },
  { id: "tracer" as const, name: "Tracer", icon: "🔍" },
  { id: "settings" as const, name: "Settings", icon: "⚙️" },
  { id: "reports" as const, name: "Reports", icon: "📋" },
]

type TabId = (typeof TABS)[number]["id"]

interface PerformanceAdminClientProps {
  userRole?: string
}

export const PerformanceAdminClient = ({
  userRole,
}: PerformanceAdminClientProps) => {
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [settings, setSettings] = useState<PerformanceSettings>(DEFAULT_SETTINGS)
  const [performanceStats] = useState({
    totalAlerts: 0,
    activeAlerts: 0,
    optimizationsApplied: 0,
    eventsTraced: 0,
    averageLoadTime: 0,
    performanceScore: 0,
  })

  const updateSettings = (
    section: keyof PerformanceSettings,
    updates: Partial<PerformanceSettings[keyof PerformanceSettings]>
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }))
  }

  const saveSettings = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("performance-settings", JSON.stringify(settings))
    }
  }

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
  }

  const exportPerformanceData = () => {
    const data = {
      settings,
      stats: performanceStats,
      timestamp: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `performance-data-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-2xl">🚨</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Alerts</p>
              <p className="text-2xl font-bold text-gray-900">
                {performanceStats.activeAlerts}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">⚡</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Optimizations Applied
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {performanceStats.optimizationsApplied}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">🔍</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Events Traced</p>
              <p className="text-2xl font-bold text-gray-900">
                {performanceStats.eventsTraced}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Performance Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {performanceStats.performanceScore}/100
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">📈</span>
              <div>
                <p className="font-medium text-gray-900">View Dashboard</p>
                <p className="text-sm text-gray-600">
                  Real-time performance metrics
                </p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="font-medium text-gray-900">Manage Alerts</p>
                <p className="text-sm text-gray-600">
                  Configure and monitor alerts
                </p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("optimizer")}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-medium text-gray-900">Run Optimizations</p>
                <p className="text-sm text-gray-600">
                  Apply performance improvements
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          System Status
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              Performance Monitoring
            </span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                settings.monitoring.enabled
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {settings.monitoring.enabled ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              Alert System
            </span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                settings.alerts.enabled
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {settings.alerts.enabled ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              Auto Optimization
            </span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                settings.optimization.autoOptimize
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {settings.optimization.autoOptimize ? "Enabled" : "Manual"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              Performance Tracing
            </span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                settings.tracing.enabled
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {settings.tracing.enabled ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Monitoring Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Enable real-time performance monitoring
              </p>
            </div>
            <VooDooCheck
              id="monitoring-enabled"
              checked={settings.monitoring.enabled}
              onChange={() =>
                updateSettings("monitoring", {
                  enabled: !settings.monitoring.enabled,
                })
              }
              labelChecked="Enable Monitoring"
              labelUnchecked="Disable Monitoring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refresh Interval (ms)
            </label>
            <input
              type="number"
              value={settings.monitoring.refreshInterval}
              onChange={(e) =>
                updateSettings("monitoring", {
                  refreshInterval: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1000}
              step={1000}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Auto Start
              </label>
              <p className="text-sm text-gray-500">
                Automatically start monitoring on page load
              </p>
            </div>
            <VooDooCheck
              id="monitoring-auto-start"
              checked={settings.monitoring.autoStart}
              onChange={() =>
                updateSettings("monitoring", {
                  autoStart: !settings.monitoring.autoStart,
                })
              }
              labelChecked="Enable Auto Start"
              labelUnchecked="Disable Auto Start"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Alert Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Enable performance alerting system
              </p>
            </div>
            <VooDooCheck
              id="alerts-enabled"
              checked={settings.alerts.enabled}
              onChange={() =>
                updateSettings("alerts", { enabled: !settings.alerts.enabled })
              }
              labelChecked="Enable Alerts"
              labelUnchecked="Disable Alerts"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Automatically resolve alerts after delay
              </p>
            </div>
            <VooDooCheck
              id="alerts-auto-resolve"
              checked={settings.alerts.autoResolve}
              onChange={() =>
                updateSettings("alerts", {
                  autoResolve: !settings.alerts.autoResolve,
                })
              }
              labelChecked="Enable Auto Resolve"
              labelUnchecked="Disable Auto Resolve"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto Resolve Delay (ms)
            </label>
            <input
              type="number"
              value={settings.alerts.autoResolveDelay}
              onChange={(e) =>
                updateSettings("alerts", {
                  autoResolveDelay: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1000}
              step={1000}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Alerts
            </label>
            <input
              type="number"
              value={settings.alerts.maxAlerts}
              onChange={(e) =>
                updateSettings("alerts", { maxAlerts: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={10}
              step={10}
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Performance Thresholds
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LCP Threshold (ms)
            </label>
            <input
              type="number"
              value={settings.thresholds.lcp}
              onChange={(e) =>
                updateSettings("thresholds", { lcp: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1000}
              step={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              FID Threshold (ms)
            </label>
            <input
              type="number"
              value={settings.thresholds.fid}
              onChange={(e) =>
                updateSettings("thresholds", { fid: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={10}
              step={10}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CLS Threshold
            </label>
            <input
              type="number"
              value={settings.thresholds.cls}
              onChange={(e) =>
                updateSettings("thresholds", { cls: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={0.01}
              step={0.01}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              FCP Threshold (ms)
            </label>
            <input
              type="number"
              value={settings.thresholds.fcp}
              onChange={(e) =>
                updateSettings("thresholds", { fcp: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={500}
              step={100}
            />
          </div>
        </div>
      </div>

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={saveSettings}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Save Settings
        </button>
        <button
          type="button"
          onClick={resetSettings}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Reset to Defaults
        </button>
        <button
          type="button"
          onClick={exportPerformanceData}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Export Data
        </button>
      </div>
    </div>
  )

  const renderReports = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Performance Reports
        </h3>
        <div className="text-center py-12">
          <span className="text-6xl mb-4 block">📊</span>
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            Reports Coming Soon
          </h4>
          <p className="text-gray-600">
            Detailed performance analytics and reporting features will be
            available in a future update.
          </p>
        </div>
      </div>
    </div>
  )

  const showPerformanceTools =
    activeTab === "dashboard" ||
    activeTab === "alerts" ||
    activeTab === "optimizer" ||
    activeTab === "tracer"

  const performanceToolsEnabled =
    activeTab === "dashboard"
      ? settings.monitoring.enabled
      : activeTab === "alerts"
        ? settings.alerts.enabled
        : activeTab === "optimizer"
          ? settings.optimization.enabled
          : settings.tracing.enabled

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Performance Admin
          </h1>
          <p className="text-gray-600">
            Comprehensive performance monitoring, alerting, optimization, and
            management tools.
          </p>
        </div>

        <nav className="mb-8 flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>

        <div className="rounded-lg bg-white shadow">
          {activeTab === "overview" && renderOverview()}
          {showPerformanceTools && (
            <div className="p-6">
              <ConditionalPerformanceLoader
                userRole={userRole}
                enabled={performanceToolsEnabled}
              />
            </div>
          )}
          {activeTab === "settings" && renderSettings()}
          {activeTab === "reports" && renderReports()}
        </div>
      </div>
    </div>
  )
}
