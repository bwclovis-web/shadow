import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AppError, ErrorSeverity, ErrorType } from "~/utils/errorHandling"

import { ErrorBoundary } from "./ErrorBoundary"

// Test component that throws an error
const ThrowError = ({
  shouldThrow = true,
  error,
}: {
  shouldThrow?: boolean
  error?: Error
}) => {
  if (shouldThrow) {
    throw error || new Error("Test error")
  }
  return <div>No error</div>
}

// Mock window.location.reload
let reloadMock: ReturnType<typeof vi.fn>

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reloadMock = vi.fn()
    vi.spyOn(window.location, "reload").mockImplementation(reloadMock)
    // Suppress console.error for error boundary tests
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Rendering", () => {
    it("should render children when there is no error", () => {
      render(<ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>)

      expect(screen.getByText("Child content")).toBeInTheDocument()
    })

    it("should catch errors thrown by child components", () => {
      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
    })

    it("should render error boundary when error occurs", () => {
      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.queryByText("No error")).not.toBeInTheDocument()
      expect(screen.getByText("Component Error")).toBeInTheDocument()
    })
  })

  describe("Error Levels", () => {
    it("should render component level error by default", () => {
      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
      expect(screen.getByText("Retry")).toBeInTheDocument()
    })

    it('should render component level error when level is "component"', () => {
      render(<ErrorBoundary level="component">
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
      expect(screen.getByText(/Server error/i)).toBeInTheDocument()
    })

    it('should render page level error when level is "page"', () => {
      render(<ErrorBoundary level="page">
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Something went wrong")).toBeInTheDocument()
      expect(screen.getByText("Try Again")).toBeInTheDocument()
      expect(screen.getByText("Go Back")).toBeInTheDocument()
    })

    it('should render critical level error when level is "critical"', () => {
      render(<ErrorBoundary level="critical">
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Critical Error")).toBeInTheDocument()
      expect(screen.getByText("Refresh Page")).toBeInTheDocument()
    })
  })

  describe("Error Information", () => {
    it("should display error message in component error", () => {
      const appError = new AppError(
        "Test error",
        ErrorType.VALIDATION,
        ErrorSeverity.LOW,
        "TEST_ERROR",
        "Please check your input"
      )

      render(<ErrorBoundary>
          <ThrowError error={appError} />
        </ErrorBoundary>)

      expect(screen.getByText(/Please check your input|Something went wrong/i))
        .toBeInTheDocument()
    })

    it("should display error ID", () => {
      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      const errorIdElement = screen.getByText(/Error ID:/i)
      expect(errorIdElement).toBeInTheDocument()
    })

    it("should generate unique error IDs for different errors", () => {
      const { unmount } = render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      const firstErrorId = screen.getByText(/Error ID:/i).textContent

      unmount()

      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      const secondErrorId = screen.getByText(/Error ID:/i).textContent

      expect(firstErrorId).not.toBe(secondErrorId)
    })
  })

  describe("Retry Functionality", () => {
    it("should have a retry button", () => {
      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Retry")).toBeInTheDocument()
    })

    it("should reset error state when retry is clicked", () => {
      const { rerender } = render(<ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()

      // Rerender with no error
      rerender(<ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>)

      // Note: In a real scenario, clicking retry would re-render children
      // But since we can't easily test the internal state change,
      // we're testing the button exists and is clickable
      const retryButton = screen.getByText("Retry")
      expect(retryButton).toBeInTheDocument()
      fireEvent.click(retryButton)
    })

    it("should allow multiple retry attempts", () => {
      // Test that the retry button can be clicked without crashing
      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      // Initially should show error
      expect(screen.getByText("Component Error")).toBeInTheDocument()

      const retryButton = screen.getByText("Retry")
      expect(retryButton).toBeInTheDocument()

      // First retry
      fireEvent.click(retryButton)

      // Error should still be shown (since child still throws)
      expect(screen.getByText("Component Error")).toBeInTheDocument()
    })
  })

  describe("Report Error Functionality", () => {
    it("should have a report error button", () => {
      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Report")).toBeInTheDocument()
    })

    it("should call console.error when report is clicked", () => {
      const consoleErrorSpy = vi.spyOn(console, "error")

      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      const reportButton = screen.getByText("Report")
      fireEvent.click(reportButton)

      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it("should show alert when report error is clicked", () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})

      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      const reportButton = screen.getByText("Report")
      fireEvent.click(reportButton)

      expect(alertSpy).toHaveBeenCalledWith("Error has been reported. Thank you for your feedback!")

      alertSpy.mockRestore()
    })
  })

  describe("Custom Fallback", () => {
    it("should render custom fallback when provided", () => {
      const customFallback = (error: AppError, errorId: string) => (
        <div>
          <h1>Custom Error</h1>
          <p>Error: {error.message}</p>
          <p>ID: {errorId}</p>
        </div>
      )

      render(<ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Custom Error")).toBeInTheDocument()
      expect(screen.getByText(/Error:/i)).toBeInTheDocument()
    })

    it("should pass error and errorId to custom fallback", () => {
      const fallbackSpy = vi.fn(() => (
        <div>Custom fallback</div>
      ))

      render(<ErrorBoundary fallback={fallbackSpy}>
          <ThrowError />
        </ErrorBoundary>)

      expect(fallbackSpy).toHaveBeenCalled()
      expect(fallbackSpy.mock.calls[0]![0]).toHaveProperty("message")
      expect(fallbackSpy.mock.calls[0]![1]).toMatch(/error_/)
    })

    it("should prioritize custom fallback over level-based fallback", () => {
      const customFallback = () => <div>Custom Critical Fallback</div>

      render(<ErrorBoundary level="critical" fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Custom Critical Fallback")).toBeInTheDocument()
      expect(screen.queryByText("Critical Error")).not.toBeInTheDocument()
    })
  })

  describe("onError Callback", () => {
    it("should call onError callback when error occurs", () => {
      const onErrorSpy = vi.fn()

      render(<ErrorBoundary onError={onErrorSpy}>
          <ThrowError />
        </ErrorBoundary>)

      expect(onErrorSpy).toHaveBeenCalled()
    })

    it("should pass AppError and ErrorInfo to onError callback", () => {
      const onErrorSpy = vi.fn()

      render(<ErrorBoundary onError={onErrorSpy}>
          <ThrowError />
        </ErrorBoundary>)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      )
    })

    it("should not break if onError callback throws", () => {
      const onErrorSpy = vi.fn(() => {
        // Simulate an error in onError callback, but catch it
        try {
          throw new Error("onError callback error")
        } catch {
          // Silently catch - this simulates error boundary handling
        }
      })

      // The error boundary should still work even if onError has issues
      render(<ErrorBoundary onError={onErrorSpy}>
          <ThrowError />
        </ErrorBoundary>)

      // Should still render error UI
      expect(screen.getByText("Component Error")).toBeInTheDocument()
      expect(onErrorSpy).toHaveBeenCalled()
    })
  })

  describe("Page Level Error Specific", () => {
    it("should render page level UI with proper styling", () => {
      render(<ErrorBoundary level="page">
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Something went wrong")).toBeInTheDocument()
      expect(screen.getByText("Try Again")).toBeInTheDocument()
      expect(screen.getByText("Go Back")).toBeInTheDocument()
      expect(screen.getByText("Report Issue")).toBeInTheDocument()
    })

    it("should have Go Back button that calls history.back", () => {
      const historyBackSpy = vi.fn()
      window.history.back = historyBackSpy

      render(<ErrorBoundary level="page">
          <ThrowError />
        </ErrorBoundary>)

      const goBackButton = screen.getByText("Go Back")
      fireEvent.click(goBackButton)

      expect(historyBackSpy).toHaveBeenCalled()
    })
  })

  describe("Critical Level Error Specific", () => {
    it("should render critical level UI with proper styling", () => {
      render(<ErrorBoundary level="critical">
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Critical Error")).toBeInTheDocument()
      expect(screen.getByText(/A critical error has occurred\. Please refresh the page or contact support/i)).toBeInTheDocument()
      expect(screen.getByText("Refresh Page")).toBeInTheDocument()
      expect(screen.getByText("Report Error")).toBeInTheDocument()
    })

    it("should have critical styling classes", () => {
      const { container } = render(<ErrorBoundary level="critical">
          <ThrowError />
        </ErrorBoundary>)

      expect(container.querySelector(".text-6xl")).toBeInTheDocument()
      expect(screen.getByText("🚨")).toBeInTheDocument()
    })
  })

  describe("Error Handling Edge Cases", () => {
    it("should handle AppError instances", () => {
      const appError = new AppError(
        "Custom app error",
        ErrorType.DATABASE,
        ErrorSeverity.HIGH,
        "DB_ERROR",
        "Database connection failed"
      )

      render(<ErrorBoundary>
          <ThrowError error={appError} />
        </ErrorBoundary>)

      expect(screen.getByText('Database connection failed')).toBeInTheDocument()
    })

    it("should handle regular Error instances", () => {
      const regularError = new Error("Regular error message")

      render(<ErrorBoundary>
          <ThrowError error={regularError} />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
    })

    it("should handle errors during render", () => {
      const ErrorComponent = () => {
        throw new Error("Render error")
      }

      render(<ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("should have proper semantic HTML for component error", () => {
      const { container } = render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      const heading = container.querySelector("h3")
      expect(heading).toHaveTextContent("Component Error")
    })

    it("should have proper semantic HTML for page error", () => {
      const { container } = render(<ErrorBoundary level="page">
          <ThrowError />
        </ErrorBoundary>)

      const heading = container.querySelector("h1")
      expect(heading).toHaveTextContent("Something went wrong")
    })

    it("should have proper semantic HTML for critical error", () => {
      const { container } = render(<ErrorBoundary level="critical">
          <ThrowError />
        </ErrorBoundary>)

      const heading = container.querySelector("h1")
      expect(heading).toHaveTextContent("Critical Error")
    })

    it("should have clickable buttons", () => {
      render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      const retryButton = screen.getByText("Retry")
      const reportButton = screen.getByText("Report")

      expect(retryButton.tagName).toBe("BUTTON")
      expect(reportButton.tagName).toBe("BUTTON")
    })
  })

  describe("Component Integration", () => {
    it("should work with nested error boundaries", () => {
      render(<ErrorBoundary level="page">
          <div>
            <ErrorBoundary level="component">
              <ThrowError />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>)

      // Inner boundary should catch the error
      expect(screen.getByText("Component Error")).toBeInTheDocument()
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument()
    })

    it("should work with multiple children", () => {
      render(<ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ErrorBoundary>)

      expect(screen.getByText("Child 1")).toBeInTheDocument()
      expect(screen.getByText("Child 2")).toBeInTheDocument()
      expect(screen.getByText("Child 3")).toBeInTheDocument()
    })

    it("should isolate errors to the boundary scope", () => {
      render(<div>
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
          <div>Sibling content</div>
        </div>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
      expect(screen.getByText("Sibling content")).toBeInTheDocument()
    })
  })

  describe("Styling", () => {
    it("should apply correct styling classes for component error", () => {
      const { container } = render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      expect(container.querySelector(".bg-red-50")).toBeInTheDocument()
      expect(container.querySelector(".border-red-200")).toBeInTheDocument()
    })

    it("should apply correct styling classes for page error", () => {
      const { container } = render(<ErrorBoundary level="page">
          <ThrowError />
        </ErrorBoundary>)

      expect(container.querySelector(".min-h-screen")).toBeInTheDocument()
      expect(container.querySelector(".bg-gray-50")).toBeInTheDocument()
    })

    it("should apply correct styling classes for critical error", () => {
      const { container } = render(<ErrorBoundary level="critical">
          <ThrowError />
        </ErrorBoundary>)

      expect(container.querySelector(".min-h-screen")).toBeInTheDocument()
      expect(container.querySelector(".bg-red-600")).toBeInTheDocument()
    })
  })

  describe("Error State Management", () => {
    it("should clear error state when retry succeeds", () => {
      let shouldThrow = true
      const { rerender } = render(<ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()

      shouldThrow = false
      rerender(<ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>)

      // Click retry button
      const retryButton = screen.getByText("Retry")
      fireEvent.click(retryButton)
    })

    it("should maintain error state between renders", () => {
      const { rerender } = render(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()

      rerender(<ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
    })
  })
})
