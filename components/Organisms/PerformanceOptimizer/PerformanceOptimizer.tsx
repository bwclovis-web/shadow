import React, { useCallback, useEffect, useMemo, useState } from "react"

import { styleMerge } from "~/utils/styleUtils"

interface OptimizationRule {
  id: string
  name: string
  description: string
  category: "images" | "scripts" | "styles" | "network" | "rendering" | "memory"
  priority: "low" | "medium" | "high"
  enabled: boolean
  action: () => Promise<void> | void
  condition: () => boolean
  impact: "low" | "medium" | "high"
}

interface OptimizationResult {
  id: string
  ruleId: string
  name: string
  description: string
  applied: boolean
  timestamp: number
  impact: "low" | "medium" | "high"
  error?: string
}

interface PerformanceOptimizerProps {
  enabled?: boolean
  showUI?: boolean
  className?: string
  autoOptimize?: boolean
  customRules?: OptimizationRule[]
}

const PerformanceOptimizer: React.FC<PerformanceOptimizerProps> = ({
  enabled = process.env.NODE_ENV === "development",
  showUI = true,
  className = "",
  autoOptimize = false,
  customRules = [],
}) => {
  const [optimizations, setOptimizations] = useState<OptimizationResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  // Default optimization rules
  const defaultRules: OptimizationRule[] = [
    {
      id: "lazy-load-images",
      name: "Enable Lazy Loading",
      description: "Add lazy loading to images below the fold",
      category: "images",
      priority: "high",
      enabled: true,
      action: () => {
        const images = document.querySelectorAll("img:not([loading])")
        images.forEach(img => {
          if (img.getBoundingClientRect().top > window.innerHeight) {
            img.setAttribute("loading", "lazy")
          }
        })
      },
      condition: () => {
        const images = document.querySelectorAll("img:not([loading])")
        return images.length > 0
      },
      impact: "high",
    },
    {
      id: "preload-critical-resources",
      name: "Preload Critical Resources",
      description: "Add preload hints for critical CSS and fonts",
      category: "network",
      priority: "high",
      enabled: true,
      action: () => {
        const criticalCSS = document.querySelector('link[rel="stylesheet"]')
        if (criticalCSS) {
          const preloadLink = document.createElement("link")
          preloadLink.rel = "preload"
          preloadLink.href = criticalCSS.getAttribute("href") || ""
          preloadLink.as = "style"
          document.head.appendChild(preloadLink)
        }
      },
      condition: () => {
        const existingPreloads = document.querySelectorAll('link[rel="preload"]')
        return existingPreloads.length === 0
      },
      impact: "high",
    },
    {
      id: "defer-non-critical-js",
      name: "Defer Non-Critical JavaScript",
      description: "Add defer attribute to non-critical scripts",
      category: "scripts",
      priority: "medium",
      enabled: true,
      action: () => {
        const scripts = document.querySelectorAll("script:not([defer]):not([async])")
        scripts.forEach(script => {
          if (!script.src.includes("critical") && !script.src.includes("main")) {
            script.setAttribute("defer", "true")
          }
        })
      },
      condition: () => {
        const scripts = document.querySelectorAll("script:not([defer]):not([async])")
        return scripts.length > 0
      },
      impact: "medium",
    },
    {
      id: "optimize-images",
      name: "Optimize Image Formats",
      description: "Convert images to WebP format for better compression",
      category: "images",
      priority: "medium",
      enabled: true,
      action: () => {
        // This would typically involve server-side processing
      },
      condition: () => {
        const images = document.querySelectorAll('img[src$=".jpg"], img[src$=".png"]')
        return images.length > 0
      },
      impact: "medium",
    },
    {
      id: "minify-css",
      name: "Minify CSS",
      description: "Remove unnecessary whitespace and comments from CSS",
      category: "styles",
      priority: "low",
      enabled: true,
      action: () => {
        // This would typically be done at build time
      },
      condition: () => process.env.NODE_ENV === "development",
      impact: "low",
    },
    {
      id: "enable-gzip",
      name: "Enable Gzip Compression",
      description: "Enable gzip compression for text-based resources",
      category: "network",
      priority: "high",
      enabled: true,
      action: () => {
        // This would be configured server-side
      },
      condition: () => true, // Always applicable
      impact: "high",
    },
    {
      id: "reduce-dom-complexity",
      name: "Reduce DOM Complexity",
      description:
        "Simplify complex DOM structures for better rendering performance",
      category: "rendering",
      priority: "medium",
      enabled: true,
      action: () => {
        // This would involve analyzing and simplifying DOM
      },
      condition: () => {
        const elements = document.querySelectorAll("*")
        return elements.length > 1000
      },
      impact: "medium",
    },
    {
      id: "memory-cleanup",
      name: "Memory Cleanup",
      description: "Clean up unused event listeners and references",
      category: "memory",
      priority: "low",
      enabled: true,
      action: () => {
        // This would involve cleaning up event listeners
      },
      condition: () => true, // Always applicable
      impact: "low",
    },
  ]

  const rules = useMemo(() => [...defaultRules, ...customRules], [customRules])

  const runOptimization = useCallback(
    async (rule: OptimizationRule): Promise<OptimizationResult> => {
      const result: OptimizationResult = {
        id: `${rule.id}-${Date.now()}`,
        ruleId: rule.id,
        name: rule.name,
        description: rule.description,
        applied: false,
        timestamp: Date.now(),
        impact: rule.impact,
      }

      try {
        if (rule.condition()) {
          await rule.action()
          result.applied = true
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : "Unknown error"
      }

      return result
    },
    []
  )

  const runAllOptimizations = useCallback(async () => {
    if (!enabled) {
      return
    }

    setIsRunning(true)
    const results: OptimizationResult[] = []

    for (const rule of rules) {
      if (rule.enabled) {
        const result = await runOptimization(rule)
        results.push(result)
      }
    }

    setOptimizations(prev => [...results, ...prev])
    setIsRunning(false)
  }, [enabled, rules, runOptimization])

  const runOptimizationById = useCallback(
    async (ruleId: string) => {
      const rule = rules.find(r => r.id === ruleId)
      if (!rule) {
        return
      }

      const result = await runOptimization(rule)
      setOptimizations(prev => [result, ...prev])
    },
    [rules, runOptimization]
  )

  // Note: Rule toggling is not supported with memoized rules
  // Rules can only be modified through the customRules prop

  const clearResults = useCallback(() => {
    setOptimizations([])
  }, [])

  // Auto-optimize on mount if enabled
  useEffect(() => {
    if (enabled && autoOptimize) {
      const timer = setTimeout(runAllOptimizations, 2000) // Wait 2 seconds after page load
      return () => clearTimeout(timer)
    }
  }, [enabled, autoOptimize])

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-red-600 bg-red-100"
      case "medium":
        return "text-yellow-600 bg-yellow-100"
      case "low":
        return "text-green-600 bg-green-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "images":
        return "🖼️"
      case "scripts":
        return "📜"
      case "styles":
        return "🎨"
      case "network":
        return "🌐"
      case "rendering":
        return "⚡"
      case "memory":
        return "🧠"
      default:
        return "⚙️"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600"
      case "medium":
        return "text-yellow-600"
      case "low":
        return "text-green-600"
      default:
        return "text-gray-600"
    }
  }

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
        <h2 className="text-xl font-bold text-gray-800">Performance Optimizer</h2>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isRunning ? "bg-blue-400 animate-pulse" : "bg-gray-400"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isRunning ? "Running..." : "Ready"}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={runAllOptimizations}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? "Running..." : "Run All Optimizations"}
        </button>
        <button
          onClick={clearResults}
          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
        >
          Clear Results
        </button>
      </div>

      {/* Optimization Rules */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Optimization Rules
        </h3>
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getCategoryIcon(rule.category)}</span>
                  <div>
                    <div className="font-medium text-gray-800">{rule.name}</div>
                    <div className="text-sm text-gray-600">{rule.description}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${getImpactColor(rule.impact)}`}
                  >
                    {rule.impact} impact
                  </span>
                  <span className={`text-xs ${getPriorityColor(rule.priority)}`}>
                    {rule.priority} priority
                  </span>
                  <div
                    className={`w-4 h-4 rounded border-2 ${
                      rule.enabled
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    {rule.enabled && (
                      <div className="w-2 h-2 bg-white rounded-sm m-0.5" />
                    )}
                  </div>
                  <button
                    onClick={() => runOptimizationById(rule.id)}
                    disabled={isRunning}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 disabled:opacity-50 transition-colors"
                  >
                    Run
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optimization Results */}
      {optimizations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Optimization Results
          </h3>
          <div className="space-y-3">
            {optimizations.slice(0, 10).map(result => (
              <div
                key={result.id}
                className={`p-4 rounded-lg border ${
                  result.applied
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{result.applied ? "✅" : "❌"}</span>
                    <div>
                      <div className="font-medium text-gray-800">{result.name}</div>
                      <div className="text-sm text-gray-600">
                        {result.description}
                      </div>
                      {result.error && (
                        <div className="text-sm text-red-600 mt-1">
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {optimizations.length > 10 && (
              <div className="text-sm text-gray-500 text-center">
                ... and {optimizations.length - 10} more results
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">Optimization Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-blue-600">Total Rules</div>
            <div className="font-semibold text-blue-800">{rules.length}</div>
          </div>
          <div>
            <div className="text-blue-600">Enabled</div>
            <div className="font-semibold text-blue-800">
              {rules.filter(rule => rule.enabled).length}
            </div>
          </div>
          <div>
            <div className="text-blue-600">Applied</div>
            <div className="font-semibold text-blue-800">
              {optimizations.filter(result => result.applied).length}
            </div>
          </div>
          <div>
            <div className="text-blue-600">Failed</div>
            <div className="font-semibold text-blue-800">
              {optimizations.filter(result => !result.applied).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PerformanceOptimizer
