import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import PerformanceMonitor from "./PerformanceMonitor"

describe("PerformanceMonitor (Container)", () => {
  let mockPerformanceObserver: any
  let performanceObserverInstances: any[] = []
  let mockGtag: any
  let mockGetEntriesByType: any

  beforeEach(() => {
    vi.clearAllMocks()
    performanceObserverInstances = []
    mockGtag = vi.fn()

    // Mock PerformanceObserver
    mockPerformanceObserver = vi.fn((callback: any) => {
      const instance = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        callback,
      }
      performanceObserverInstances.push(instance)
      return instance
    })

    global.PerformanceObserver = mockPerformanceObserver as any

    // Mock window.gtag
    ;(global.window as any).gtag = mockGtag

    // Mock performance API - create spy for getEntriesByType
    mockGetEntriesByType = vi.fn((type: string) => {
      if (type === "navigation") {
        return [
          {
            domainLookupStart: 0,
            domainLookupEnd: 10,
            connectStart: 10,
            connectEnd: 50,
            requestStart: 50,
            responseStart: 200,
            navigationStart: 0,
            domContentLoadedEventEnd: 1500,
            loadEventEnd: 2500,
          },
        ]
      }
      return []
    })

    // Set up performance mock on both global and window
    global.performance = {
      ...global.performance,
      now: vi.fn(() => Date.now()),
      getEntriesByType: mockGetEntriesByType,
    } as any

    // Ensure window.performance is also set
    ;(global.window as any).performance = global.performance
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (global.window as any).gtag
  })

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<PerformanceMonitor />)
      expect(container.firstChild).toBeNull()
    })

    it("should return null (no visual output)", () => {
      const { container } = render(<PerformanceMonitor />)
      expect(container.innerHTML).toBe("")
    })
  })

  describe("Development Mode Behavior", () => {
    it("should not set up observers in development mode", () => {
      // Mock development environment
      vi.stubEnv("DEV", true)

      render(<PerformanceMonitor />)

      expect(mockPerformanceObserver).not.toHaveBeenCalled()

      vi.unstubAllEnvs()
    })

    it("should set up observers in production mode", () => {
      // Mock production environment
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      // Should create observers for LCP, FID, CLS, FCP, TTI
      expect(performanceObserverInstances.length).toBeGreaterThanOrEqual(5)

      vi.unstubAllEnvs()
    })
  })

  describe("Core Web Vitals - LCP (Largest Contentful Paint)", () => {
    it("should observe LCP metric", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const lcpObserver = performanceObserverInstances[0]
      expect(lcpObserver.observe).toHaveBeenCalledWith({
        entryTypes: ["largest-contentful-paint"],
      })

      vi.unstubAllEnvs()
    })

    it("should send LCP value to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const lcpObserver = performanceObserverInstances[0]
      const mockEntries = [{ startTime: 2300 }]

      // Simulate LCP entry
      lcpObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "LCP", {
        value: 2300,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })

    it("should send LCP to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const lcpObserver = performanceObserverInstances[0]
      const mockEntries = [{ startTime: 2300 }]

      lcpObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "LCP", {
        value: 2300,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })

    it("should handle empty LCP entries", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const lcpObserver = performanceObserverInstances[0]

      mockGtag.mockClear()

      lcpObserver.callback({
        getEntries: () => [],
      })

      expect(mockGtag).not.toHaveBeenCalledWith(
        "event",
        "LCP",
        expect.anything()
      )

      vi.unstubAllEnvs()
    })
  })

  describe("Core Web Vitals - FID (First Input Delay)", () => {
    it("should observe FID metric", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const fidObserver = performanceObserverInstances[1]
      expect(fidObserver.observe).toHaveBeenCalledWith({
        entryTypes: ["first-input"],
      })

      vi.unstubAllEnvs()
    })

    it("should send FID value to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const fidObserver = performanceObserverInstances[1]
      const mockEntries = [
        {
          startTime: 1000,
          processingStart: 1050,
        },
      ]

      fidObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "FID", {
        value: 50,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })

    it("should send FID to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const fidObserver = performanceObserverInstances[1]
      const mockEntries = [
        {
          startTime: 1000,
          processingStart: 1080,
        },
      ]

      fidObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "FID", {
        value: 80,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })
  })

  describe("Core Web Vitals - CLS (Cumulative Layout Shift)", () => {
    it("should observe CLS metric", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const clsObserver = performanceObserverInstances[2]
      expect(clsObserver.observe).toHaveBeenCalledWith({
        entryTypes: ["layout-shift"],
      })

      vi.unstubAllEnvs()
    })

    it("should accumulate CLS values", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const clsObserver = performanceObserverInstances[2]

      // First layout shift
      clsObserver.callback({
        getEntries: () => [{ value: 0.05, hadRecentInput: false }],
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "CLS", {
        value: 0.05,
        event_category: "Web Vitals",
      })

      // Second layout shift
      clsObserver.callback({
        getEntries: () => [{ value: 0.03, hadRecentInput: false }],
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "CLS", {
        value: 0.08,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })

    it("should ignore layout shifts with recent input", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const clsObserver = performanceObserverInstances[2]

      // Clear any previous gtag calls
      mockGtag.mockClear()

      clsObserver.callback({
        getEntries: () => [{ value: 0.05, hadRecentInput: true }],
      })

      expect(mockGtag).not.toHaveBeenCalledWith(
        "event",
        "CLS",
        expect.anything()
      )

      vi.unstubAllEnvs()
    })

    it("should send CLS to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const clsObserver = performanceObserverInstances[2]

      clsObserver.callback({
        getEntries: () => [{ value: 0.123456, hadRecentInput: false }],
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "CLS", {
        value: 0.123,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })
  })

  describe("Core Web Vitals - FCP (First Contentful Paint)", () => {
    it("should observe FCP metric", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const fcpObserver = performanceObserverInstances[3]
      expect(fcpObserver.observe).toHaveBeenCalledWith({
        entryTypes: ["first-contentful-paint"],
      })

      vi.unstubAllEnvs()
    })

    it("should send FCP value to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const fcpObserver = performanceObserverInstances[3]
      const mockEntries = [{ startTime: 1200 }]

      fcpObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "FCP", {
        value: 1200,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })

    it("should send FCP to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const fcpObserver = performanceObserverInstances[3]
      const mockEntries = [{ startTime: 1234 }]

      fcpObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "FCP", {
        value: 1234,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })
  })

  describe("Core Web Vitals - TTI (Time to Interactive)", () => {
    it("should observe TTI using longtask", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const ttiObserver = performanceObserverInstances[4]
      expect(ttiObserver.observe).toHaveBeenCalledWith({
        entryTypes: ["longtask"],
      })

      vi.unstubAllEnvs()
    })

    it("should send TTI value to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const ttiObserver = performanceObserverInstances[4]
      const mockEntries = [{ startTime: 3500 }]

      ttiObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "TTI", {
        value: 3500,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })

    it("should send TTI to analytics", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const ttiObserver = performanceObserverInstances[4]
      const mockEntries = [{ startTime: 3800 }]

      ttiObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "TTI", {
        value: 3800,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })
  })

  describe("Navigation Performance Metrics", () => {
    it("should collect navigation metrics on page load", async () => {
      vi.stubEnv("DEV", false)

      // Ensure window.performance is set up before rendering
      ;(global.window as any).performance = global.performance

      // Spy on addEventListener to verify it's called
      const addEventListenerSpy = vi.spyOn(window, "addEventListener")

      // Render component
      render(<PerformanceMonitor />)

      // Wait for addEventListener to be called (useEffect has run)
      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          "load",
          expect.any(Function)
        )
      })

      // Get the event listener callback that was registered
      const loadListenerCall = addEventListenerSpy.mock.calls.find(call => call[0] === "load")
      const loadListener = loadListenerCall?.[1] as () => void

      // Manually trigger the event listener callback
      if (loadListener) {
        loadListener()
      }

      // Wait for setTimeout to execute (use real timers for this)
      await waitFor(
        () => {
          expect(mockGetEntriesByType).toHaveBeenCalledWith("navigation")
        },
        { timeout: 100 }
      )

      addEventListenerSpy.mockRestore()
      vi.unstubAllEnvs()
    })

    it("should log performance metrics", async () => {
      vi.stubEnv("DEV", false)

      // Ensure window.performance is set up before rendering
      ;(global.window as any).performance = global.performance

      // Spy on addEventListener
      const addEventListenerSpy = vi.spyOn(window, "addEventListener")

      // Render component
      render(<PerformanceMonitor />)

      // Wait for addEventListener to be called
      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          "load",
          expect.any(Function)
        )
      })

      // Get the event listener callback
      const loadListenerCall = addEventListenerSpy.mock.calls.find(call => call[0] === "load")
      const loadListener = loadListenerCall?.[1] as () => void

      // Manually trigger the callback
      if (loadListener) {
        loadListener()
      }

      // Wait for setTimeout to execute and check that metrics are sent to analytics
      await waitFor(
        () => {
          expect(mockGtag).toHaveBeenCalledWith("event", "performance", {
            metric_name: "dns",
            value: expect.any(Number),
            event_category: "Performance",
          })
          expect(mockGtag).toHaveBeenCalledWith("event", "performance", {
            metric_name: "tcp",
            value: expect.any(Number),
            event_category: "Performance",
          })
          expect(mockGtag).toHaveBeenCalledWith("event", "performance", {
            metric_name: "ttfb",
            value: expect.any(Number),
            event_category: "Performance",
          })
          expect(mockGtag).toHaveBeenCalledWith("event", "performance", {
            metric_name: "domContentLoaded",
            value: expect.any(Number),
            event_category: "Performance",
          })
          expect(mockGtag).toHaveBeenCalledWith("event", "performance", {
            metric_name: "loadComplete",
            value: expect.any(Number),
            event_category: "Performance",
          })
        },
        { timeout: 100 }
      )

      addEventListenerSpy.mockRestore()
      vi.unstubAllEnvs()
    })

    it("should send navigation metrics to analytics", async () => {
      vi.stubEnv("DEV", false)

      // Ensure window.performance is set up before rendering
      ;(global.window as any).performance = global.performance

      // Spy on addEventListener
      const addEventListenerSpy = vi.spyOn(window, "addEventListener")

      // Render component
      render(<PerformanceMonitor />)

      // Wait for addEventListener to be called
      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          "load",
          expect.any(Function)
        )
      })

      // Get the event listener callback
      const loadListenerCall = addEventListenerSpy.mock.calls.find(call => call[0] === "load")
      const loadListener = loadListenerCall?.[1] as () => void

      // Manually trigger the callback
      if (loadListener) {
        loadListener()
      }

      // Wait for setTimeout to execute
      await waitFor(
        () => {
          expect(mockGtag).toHaveBeenCalledWith("event", "performance", {
            metric_name: "dns",
            value: expect.any(Number),
            event_category: "Performance",
          })

          expect(mockGtag).toHaveBeenCalledWith("event", "performance", {
            metric_name: "tcp",
            value: expect.any(Number),
            event_category: "Performance",
          })
        },
        { timeout: 100 }
      )

      addEventListenerSpy.mockRestore()
      vi.unstubAllEnvs()
    })
  })

  describe("Analytics Integration", () => {
    it("should work without gtag", () => {
      vi.stubEnv("DEV", false)
      delete (global.window as any).gtag

      render(<PerformanceMonitor />)

      const lcpObserver = performanceObserverInstances[0]
      const mockEntries = [{ startTime: 2300 }]

      // Should not throw error
      expect(() => {
        lcpObserver.callback({
          getEntries: () => mockEntries,
        })
      }).not.toThrow()

      vi.unstubAllEnvs()
    })

    it("should round metric values before sending", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const lcpObserver = performanceObserverInstances[0]
      const mockEntries = [{ startTime: 2345.6789 }]

      lcpObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "LCP", {
        value: 2346,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })
  })

  describe("Cleanup", () => {
    it("should disconnect all observers on unmount", () => {
      vi.stubEnv("DEV", false)

      const { unmount } = render(<PerformanceMonitor />)

      unmount()

      performanceObserverInstances.forEach(instance => {
        expect(instance.disconnect).toHaveBeenCalled()
      })

      vi.unstubAllEnvs()
    })
  })

  describe("Browser Compatibility", () => {
    it("should handle missing PerformanceObserver", () => {
      vi.stubEnv("DEV", false)
      delete (global as any).PerformanceObserver

      expect(() => {
        render(<PerformanceMonitor />)
      }).not.toThrow()

      vi.unstubAllEnvs()
    })

    it("should handle missing performance API", () => {
      vi.stubEnv("DEV", false)
      const originalPerformance = global.performance

      // Mock minimal performance object without full API
      ;(global as any).performance = {
        now: vi.fn(() => 0),
        getEntriesByType: vi.fn(() => []),
      }

      // Component should render without throwing
      const { container } = render(<PerformanceMonitor />)
      expect(container).toBeInTheDocument()

      global.performance = originalPerformance

      vi.unstubAllEnvs()
    })
  })

  describe("Edge Cases", () => {
    it("should handle multiple entries in observer callback", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const fidObserver = performanceObserverInstances[1]
      const mockEntries = [
        { startTime: 1000, processingStart: 1050 },
        { startTime: 2000, processingStart: 2030 },
      ]

      fidObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "FID", {
        value: 50,
        event_category: "Web Vitals",
      })
      expect(mockGtag).toHaveBeenCalledWith("event", "FID", {
        value: 30,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })

    it("should handle zero values", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const lcpObserver = performanceObserverInstances[0]
      const mockEntries = [{ startTime: 0 }]

      lcpObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "LCP", {
        value: 0,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })

    it("should handle negative timing values", () => {
      vi.stubEnv("DEV", false)

      render(<PerformanceMonitor />)

      const fidObserver = performanceObserverInstances[1]
      const mockEntries = [
        {
          startTime: 1000,
          processingStart: 990, // Earlier than startTime
        },
      ]

      fidObserver.callback({
        getEntries: () => mockEntries,
      })

      expect(mockGtag).toHaveBeenCalledWith("event", "FID", {
        value: -10,
        event_category: "Web Vitals",
      })

      vi.unstubAllEnvs()
    })
  })
})
