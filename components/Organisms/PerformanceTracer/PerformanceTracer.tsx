import React, { useCallback, useEffect, useRef, useState } from "react"

import { styleMerge } from "~/utils/styleUtils"

interface TraceEvent {
  id: string
  name: string
  category: string
  startTime: number
  endTime?: number
  duration?: number
  data?: Record<string, any>
  children?: TraceEvent[]
  parentId?: string
}

interface PerformanceTracerProps {
  enabled?: boolean
  showUI?: boolean
  className?: string
  maxEvents?: number
  categories?: string[]
  autoStart?: boolean
}

const PerformanceTracer: React.FC<PerformanceTracerProps> = ({
  enabled = process.env.NODE_ENV === "development",
  showUI = true,
  className = "",
  maxEvents = 1000,
  categories = [
"navigation", "resource", "paint", "measure", "mark"
],
  autoStart = true,
}) => {
  const [events, setEvents] = useState<TraceEvent[]>([])
  const [isTracing, setIsTracing] = useState(false)
  const [filters, setFilters] = useState({
    category: "",
    minDuration: 0,
    search: "",
  })
  const [selectedEvent, setSelectedEvent] = useState<TraceEvent | null>(null)
  const observerRef = useRef<PerformanceObserver | null>(null)
  const eventCounterRef = useRef(0)

  const startTracing = useCallback(() => {
    if (
      !enabled ||
      typeof window === "undefined" ||
      !("PerformanceObserver" in window)
    ) {
      return
    }

    setIsTracing(true)
    setEvents([])
    eventCounterRef.current = 0

    try {
      observerRef.current = new PerformanceObserver(list => {
        const newEvents = list
          .getEntries()
          .filter(entry => categories.includes(entry.entryType))
          .map((entry: PerformanceEntry): TraceEvent => {
            const event: TraceEvent = {
              id: `event-${++eventCounterRef.current}`,
              name: entry.name,
              category: entry.entryType,
              startTime: entry.startTime,
              endTime: entry.startTime + entry.duration,
              duration: entry.duration,
              data: {
                type: entry.entryType,
                name: entry.name,
                startTime: entry.startTime,
                duration: entry.duration,
              },
            }

            // Add specific data based on entry type
            if (entry.entryType === "navigation") {
              const navEntry = entry as PerformanceNavigationTiming
              event.data = {
                ...event.data,
                dns: navEntry.domainLookupEnd - navEntry.domainLookupStart,
                tcp: navEntry.connectEnd - navEntry.connectStart,
                ttfb: navEntry.responseStart - navEntry.requestStart,
                domContentLoaded:
                  navEntry.domContentLoadedEventEnd - navEntry.navigationStart,
                loadComplete: navEntry.loadEventEnd - navEntry.navigationStart,
              }
            } else if (entry.entryType === "resource") {
              const resourceEntry = entry as PerformanceResourceTiming
              event.data = {
                ...event.data,
                transferSize: resourceEntry.transferSize,
                encodedBodySize: resourceEntry.encodedBodySize,
                decodedBodySize: resourceEntry.decodedBodySize,
                initiatorType: resourceEntry.initiatorType,
                nextHopProtocol: resourceEntry.nextHopProtocol,
              }
            } else if (entry.entryType === "paint") {
              const paintEntry = entry as PerformancePaintTiming
              event.data = {
                ...event.data,
                paintType: paintEntry.name,
              }
            } else if (entry.entryType === "measure") {
              const measureEntry = entry as PerformanceMeasure
              event.data = {
                ...event.data,
                detail: measureEntry.detail,
              }
            }

            return event
          })

        setEvents(prev => {
          const updated = [...newEvents, ...prev]
          return updated.slice(0, maxEvents)
        })
      })

      observerRef.current.observe({ entryTypes: categories })
    } catch (error) {
      console.error("Error starting performance tracing:", error)
      setIsTracing(false)
    }
  }, [enabled, categories, maxEvents])

  const stopTracing = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    setIsTracing(false)
  }, [])

  const clearEvents = useCallback(() => {
    setEvents([])
    setSelectedEvent(null)
  }, [])

  const addCustomMark = useCallback(
    (name: string, data?: Record<string, any>) => {
      if (!enabled || typeof window === "undefined") {
        return
      }

      performance.mark(name)

      const event: TraceEvent = {
        id: `custom-${++eventCounterRef.current}`,
        name,
        category: "mark",
        startTime: performance.now(),
        data: { ...data, custom: true },
      }

      setEvents(prev => [event, ...prev].slice(0, maxEvents))
    },
    [enabled, maxEvents]
  )

  const addCustomMeasure = useCallback(
    (
      name: string,
      startMark: string,
      endMark?: string,
      data?: Record<string, any>
    ) => {
      if (!enabled || typeof window === "undefined") {
        return
      }

      try {
        performance.measure(name, startMark, endMark)

        const event: TraceEvent = {
          id: `measure-${++eventCounterRef.current}`,
          name,
          category: "measure",
          startTime: performance.now(),
          data: { ...data, custom: true, startMark, endMark },
        }

        setEvents(prev => [event, ...prev].slice(0, maxEvents))
      } catch (error) {
        console.error("Error adding custom measure:", error)
      }
    },
    [enabled, maxEvents]
  )

  const filteredEvents = events.filter(event => {
    if (filters.category && event.category !== filters.category) {
      return false
    }
    if (filters.minDuration > 0 && (event.duration || 0) < filters.minDuration) {
      return false
    }
    if (
      filters.search &&
      !event.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false
    }
    return true
  })

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "navigation":
        return "bg-blue-100 text-blue-800"
      case "resource":
        return "bg-green-100 text-green-800"
      case "paint":
        return "bg-purple-100 text-purple-800"
      case "measure":
        return "bg-yellow-100 text-yellow-800"
      case "mark":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "navigation":
        return "🧭"
      case "resource":
        return "📦"
      case "paint":
        return "🎨"
      case "measure":
        return "📏"
      case "mark":
        return "📍"
      default:
        return "⚙️"
    }
  }

  const formatDuration = (duration: number) => {
    if (duration < 1) {
      return `${(duration * 1000).toFixed(1)}μs`
    }
    if (duration < 1000) {
      return `${duration.toFixed(1)}ms`
    }
    return `${(duration / 1000).toFixed(1)}s`
  }

  const formatTime = (time: number) => new Date(time).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    })

  useEffect(() => {
    if (enabled && autoStart) {
      startTracing()
    }

    return () => {
      stopTracing()
    }
  }, [enabled, autoStart])

  // Expose methods globally for debugging
  useEffect(() => {
    if (enabled && typeof window !== "undefined") {
      ;(window as any).performanceTracer = {
        addMark: addCustomMark,
        addMeasure: addCustomMeasure,
        start: startTracing,
        stop: stopTracing,
        clear: clearEvents,
      }
    }
  }, [
    enabled,
    addCustomMark,
    addCustomMeasure,
    startTracing,
    stopTracing,
    clearEvents,
  ])

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
        <h2 className="text-xl font-bold text-gray-800">Performance Tracer</h2>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isTracing ? "bg-green-400 animate-pulse" : "bg-gray-400"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isTracing ? "Tracing" : "Stopped"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={isTracing ? stopTracing : startTracing}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isTracing
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {isTracing ? "Stop Tracing" : "Start Tracing"}
        </button>
        <button
          onClick={clearEvents}
          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md text-sm hover:bg-gray-200 transition-colors"
        >
          Clear Events
        </button>
        <button
          onClick={() => addCustomMark("custom-mark", { timestamp: Date.now() })}
          className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md text-sm hover:bg-blue-200 transition-colors"
        >
          Add Mark
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={filters.category}
            onChange={e => setFilters(prev => ({ ...prev, category: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Duration (ms)
          </label>
          <input
            type="number"
            value={filters.minDuration}
            onChange={e => setFilters(prev => ({
                ...prev,
                minDuration: Number(e.target.value),
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            min="0"
            step="0.1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))
            }
            placeholder="Search events..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      {/* Event List */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Events ({filteredEvents.length})
        </h3>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {filteredEvents.map(event => (
            <div
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedEvent?.id === event.id
                  ? "bg-blue-50 border-blue-300"
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getCategoryIcon(event.category)}</span>
                  <div>
                    <div className="font-medium text-gray-800">{event.name}</div>
                    <div className="text-sm text-gray-600">
                      {formatTime(event.startTime)} •{" "}
                      {formatDuration(event.duration || 0)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${getCategoryColor(event.category)}`}
                  >
                    {event.category}
                  </span>
                  {event.data?.custom && (
                    <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                      Custom
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Event Details */}
      {selectedEvent && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Event Details</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm font-medium text-gray-600">Name</div>
                <div className="text-gray-800">{selectedEvent.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">Category</div>
                <div className="text-gray-800">{selectedEvent.category}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">Start Time</div>
                <div className="text-gray-800">
                  {formatTime(selectedEvent.startTime)}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">Duration</div>
                <div className="text-gray-800">
                  {formatDuration(selectedEvent.duration || 0)}
                </div>
              </div>
            </div>
            {selectedEvent.data && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-2">Data</div>
                <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                  {JSON.stringify(selectedEvent.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">Tracing Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-blue-600">Total Events</div>
            <div className="font-semibold text-blue-800">{events.length}</div>
          </div>
          <div>
            <div className="text-blue-600">Filtered</div>
            <div className="font-semibold text-blue-800">
              {filteredEvents.length}
            </div>
          </div>
          <div>
            <div className="text-blue-600">Categories</div>
            <div className="font-semibold text-blue-800">
              {new Set(events.map(e => e.category)).size}
            </div>
          </div>
          <div>
            <div className="text-blue-600">Custom Events</div>
            <div className="font-semibold text-blue-800">
              {events.filter(e => e.data?.custom).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PerformanceTracer
