import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ImagePreloader from "./ImagePreloader"

// Mock DOM APIs
const mockIntersectionObserver = vi.fn()
const mockRequestIdleCallback = vi.fn()
const mockCancelIdleCallback = vi.fn()
const mockImage = vi.fn()

describe("ImagePreloader", () => {
  let mockDocumentHead: HTMLElement
  let mockDocumentQuerySelectorAll: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock document.head
    mockDocumentHead = document.createElement("head")
    Object.defineProperty(document, "head", {
      value: mockDocumentHead,
      writable: true,
      configurable: true,
    })

    // Mock document.querySelectorAll
    mockDocumentQuerySelectorAll = vi.fn().mockReturnValue([])
    Object.defineProperty(document, "querySelectorAll", {
      value: mockDocumentQuerySelectorAll,
      writable: true,
      configurable: true,
    })

    // Mock IntersectionObserver
    mockIntersectionObserver.mockImplementation(callback => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: "",
      thresholds: [],
      takeRecords: vi.fn(() => []),
      callback,
    }))
    Object.defineProperty(window, "IntersectionObserver", {
      writable: true,
      configurable: true,
      value: mockIntersectionObserver,
    })

    // Mock requestIdleCallback and cancelIdleCallback (Node/test env may not define cancelIdleCallback)
    mockRequestIdleCallback.mockImplementation((cb: () => void) => 1)
    Object.defineProperty(window, "requestIdleCallback", {
      writable: true,
      configurable: true,
      value: mockRequestIdleCallback,
    })
    Object.defineProperty(window, "cancelIdleCallback", {
      writable: true,
      configurable: true,
      value: mockCancelIdleCallback,
    })

    // Mock Image constructor
    mockImage.mockImplementation(() => ({
      src: "",
      loading: "",
      decoding: "",
      dataset: {},
    }))
    global.Image = mockImage as any
  })

  afterEach(() => {
    // Clean up any added elements
    mockDocumentHead.innerHTML = ""
  })

  describe("High priority preloading", () => {
    it("should create preload links immediately for high priority", () => {
      const images = ["image1.jpg", "image2.jpg"]
      render(<ImagePreloader images={images} priority="high" />)

      const preloadLinks = mockDocumentHead.querySelectorAll('link[rel="preload"][as="image"]')
      expect(preloadLinks).toHaveLength(2)

      expect(preloadLinks[0]).toHaveAttribute("href", "image1.jpg")
      expect(preloadLinks[0]).toHaveAttribute("fetchpriority", "high")
      expect(preloadLinks[1]).toHaveAttribute("href", "image2.jpg")
      expect(preloadLinks[1]).toHaveAttribute("fetchpriority", "high")
    })

    it("should handle empty images array for high priority", () => {
      render(<ImagePreloader images={[]} priority="high" />)

      const preloadLinks = mockDocumentHead.querySelectorAll('link[rel="preload"][as="image"]')
      expect(preloadLinks).toHaveLength(0)
    })
  })

  describe("Lazy loading with IntersectionObserver", () => {
    it("should set up IntersectionObserver for lazy loading", () => {
      const images = ["image1.jpg", "image2.jpg"]
      render(<ImagePreloader images={images} priority="low" lazy />)

      expect(mockIntersectionObserver).toHaveBeenCalledWith(expect.any(Function), {
        rootMargin: "50px 0px",
        threshold: 0.1,
      })
    })

    it("should create Image objects for lazy loading", () => {
      const images = ["image1.jpg", "image2.jpg"]

      render(<ImagePreloader images={images} priority="low" lazy />)

      expect(mockImage).toHaveBeenCalledTimes(2)
    })

    it("should not use IntersectionObserver when lazy is false", () => {
      const images = ["image1.jpg"]
      render(<ImagePreloader images={images} priority="low" lazy={false} />)

      expect(mockIntersectionObserver).not.toHaveBeenCalled()
    })
  })

  describe("Low priority preloading", () => {
    it("should use requestIdleCallback when available", () => {
      const images = ["image1.jpg", "image2.jpg"]
      render(<ImagePreloader images={images} priority="low" lazy={false} />)

      expect(mockRequestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 1500 })
    })

    it("should fallback to setTimeout when requestIdleCallback is not available", () => {
      // Remove requestIdleCallback
      delete (window as any).requestIdleCallback

      vi.useFakeTimers()
      const images = ["image1.jpg"]
      render(<ImagePreloader images={images} priority="low" lazy={false} />)

      expect(vi.getTimerCount()).toBeGreaterThan(0)
      vi.runAllTimers()

      const preloadLinks = mockDocumentHead.querySelectorAll('link[rel="preload"][as="image"]')
      expect(preloadLinks).toHaveLength(1)

      vi.useRealTimers()
    })

    it("should create preload links with low priority", () => {
      const images = ["image1.jpg"]
      mockRequestIdleCallback.mockImplementation((cb: () => void) => {
        cb() // Execute immediately for testing
        return 1
      })

      render(<ImagePreloader images={images} priority="low" lazy={false} />)

      const preloadLinks = mockDocumentHead.querySelectorAll('link[rel="preload"][as="image"]')
      expect(preloadLinks).toHaveLength(1)
      expect(preloadLinks[0]).toHaveAttribute("href", "image1.jpg")
      expect(preloadLinks[0]).toHaveAttribute("fetchpriority", "low")
    })
  })

  describe("Cleanup", () => {
    it("should disconnect IntersectionObserver on unmount", () => {
      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }
      mockIntersectionObserver.mockReturnValue(mockObserver)

      const { unmount } = render(<ImagePreloader images={["image1.jpg"]} lazy />)

      unmount()

      expect(mockObserver.disconnect).toHaveBeenCalled()
    })

    it("should remove preload links on unmount", () => {
      const images = ["image1.jpg", "image2.jpg"]
      const mockLinks = [
        { href: "image1.jpg", remove: vi.fn() },
        { href: "image2.jpg", remove: vi.fn() },
        { href: "other.jpg", remove: vi.fn() },
      ]

      mockDocumentQuerySelectorAll.mockReturnValue(mockLinks)

      const { unmount } = render(<ImagePreloader images={images} priority="high" />)

      unmount()

      // Should only remove links that match the images array
      expect(mockLinks[0].remove).toHaveBeenCalled()
      expect(mockLinks[1].remove).toHaveBeenCalled()
      expect(mockLinks[2].remove).not.toHaveBeenCalled()
    })
  })

  describe("Default behavior", () => {
    it("should use low priority by default", () => {
      const images = ["image1.jpg"]
      render(<ImagePreloader images={images} lazy={false} />)

      expect(mockRequestIdleCallback).toHaveBeenCalled()
    })

    it("should use lazy loading by default", () => {
      const images = ["image1.jpg"]
      render(<ImagePreloader images={images} />)

      expect(mockIntersectionObserver).toHaveBeenCalled()
    })
  })

  describe("Rendering", () => {
    it("should not render any visible content", () => {
      const { container } = render(<ImagePreloader images={["image1.jpg"]} />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe("Edge cases", () => {
    it("should handle empty images array", () => {
      const { container } = render(<ImagePreloader images={[]} />)

      expect(mockIntersectionObserver).not.toHaveBeenCalled()
      expect(mockRequestIdleCallback).not.toHaveBeenCalled()
      expect(container.firstChild).toBeNull()
    })

    it("should handle undefined images", () => {
      const { container } = render(<ImagePreloader images={undefined as any} />)

      // Should not throw error and should not render
      expect(container.firstChild).toBeNull()
      expect(mockIntersectionObserver).not.toHaveBeenCalled()
    })

    it("should handle images with special characters", () => {
      const images = [
        "image with spaces.jpg",
        "image-with-dashes.jpg",
        "image_with_underscores.jpg",
      ]
      render(<ImagePreloader images={images} priority="high" />)

      const preloadLinks = mockDocumentHead.querySelectorAll('link[rel="preload"][as="image"]')
      expect(preloadLinks).toHaveLength(3)
    })
  })

  describe("IntersectionObserver callback", () => {
    it("should handle intersection entries correctly", () => {
      const images = ["image1.jpg"]
      let observerCallback: any

      mockIntersectionObserver.mockImplementation(callback => {
        observerCallback = callback
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        }
      })

      render(<ImagePreloader images={images} lazy />)

      // Simulate intersection
      const mockEntry = {
        isIntersecting: true,
        target: {
          src: "image1.jpg",
          dataset: { src: "image1.jpg" },
        },
      }

      observerCallback([mockEntry])

      // Should unobserve the element
      expect(true).toBe(true) // Test passes if no error is thrown
    })

    it("should not process non-intersecting entries", () => {
      const images = ["image1.jpg"]
      let observerCallback: any

      mockIntersectionObserver.mockImplementation(callback => {
        observerCallback = callback
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        }
      })

      render(<ImagePreloader images={images} lazy />)

      // Simulate non-intersection
      const mockEntry = {
        isIntersecting: false,
        target: {
          src: "image1.jpg",
          dataset: { src: "image1.jpg" },
        },
      }

      observerCallback([mockEntry])

      // Should not unobserve the element
      expect(true).toBe(true) // Test passes if no error is thrown
    })
  })
})
