import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppError, ErrorSeverity, ErrorType } from "~/utils/errorHandling"

import CriticalError from "./CriticalError"

describe("CriticalError", () => {
  const mockError = new AppError(
    "Critical system error",
    ErrorType.SERVER,
    ErrorSeverity.CRITICAL,
    "CRITICAL_ERROR",
    "A critical error has occurred."
  )

  const mockProps = {
    error: mockError,
    errorId: "error_critical_123456",
    onRetry: vi.fn(),
    onReportError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Rendering", () => {
    it("should render critical error UI", () => {
      render(<CriticalError {...mockProps} />)

      expect(screen.getByText("Critical Error")).toBeInTheDocument()
    })

    it("should display critical error message", () => {
      render(<CriticalError {...mockProps} />)

      expect(screen.getByText(/A critical error has occurred. Please refresh the page or contact support./i)).toBeInTheDocument()
    })

    it("should display error ID", () => {
      render(<CriticalError {...mockProps} />)

      expect(screen.getByText("Error ID: error_critical_123456")).toBeInTheDocument()
    })

    it("should render alert emoji icon", () => {
      render(<CriticalError {...mockProps} />)

      expect(screen.getByText("🚨")).toBeInTheDocument()
    })

    it("should render refresh page button", () => {
      render(<CriticalError {...mockProps} />)

      expect(screen.getByText("Refresh Page")).toBeInTheDocument()
    })

    it("should render report error button", () => {
      render(<CriticalError {...mockProps} />)

      expect(screen.getByText("Report Error")).toBeInTheDocument()
    })
  })

  describe("Interactions", () => {
    it("should call onRetry when refresh page button is clicked", () => {
      const onRetrySpy = vi.fn()
      render(<CriticalError {...mockProps} onRetry={onRetrySpy} />)

      const refreshButton = screen.getByText("Refresh Page")
      fireEvent.click(refreshButton)

      expect(onRetrySpy).toHaveBeenCalledTimes(1)
    })

    it("should call onReportError when report error button is clicked", () => {
      const onReportErrorSpy = vi.fn()
      render(<CriticalError {...mockProps} onReportError={onReportErrorSpy} />)

      const reportButton = screen.getByText("Report Error")
      fireEvent.click(reportButton)

      expect(onReportErrorSpy).toHaveBeenCalledTimes(1)
    })

    it("should handle multiple refresh clicks", () => {
      const onRetrySpy = vi.fn()
      render(<CriticalError {...mockProps} onRetry={onRetrySpy} />)

      const refreshButton = screen.getByText("Refresh Page")
      fireEvent.click(refreshButton)
      fireEvent.click(refreshButton)
      fireEvent.click(refreshButton)

      expect(onRetrySpy).toHaveBeenCalledTimes(3)
    })

    it("should handle multiple report clicks", () => {
      const onReportErrorSpy = vi.fn()
      render(<CriticalError {...mockProps} onReportError={onReportErrorSpy} />)

      const reportButton = screen.getByText("Report Error")
      fireEvent.click(reportButton)
      fireEvent.click(reportButton)

      expect(onReportErrorSpy).toHaveBeenCalledTimes(2)
    })

    it("should handle clicks on both buttons", () => {
      const onRetrySpy = vi.fn()
      const onReportErrorSpy = vi.fn()

      render(<CriticalError
          {...mockProps}
          onRetry={onRetrySpy}
          onReportError={onReportErrorSpy}
        />)

      const refreshButton = screen.getByText("Refresh Page")
      const reportButton = screen.getByText("Report Error")

      fireEvent.click(refreshButton)
      fireEvent.click(reportButton)
      fireEvent.click(refreshButton)

      expect(onRetrySpy).toHaveBeenCalledTimes(2)
      expect(onReportErrorSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe("Different Error Types", () => {
    it("should display database critical error", () => {
      const dbError = new AppError(
        "Database connection lost",
        ErrorType.DATABASE,
        ErrorSeverity.CRITICAL,
        "DB_CRITICAL_ERROR",
        "Critical database error occurred."
      )

      render(<CriticalError {...mockProps} error={dbError} />)

      // Should still show the standard critical error message
      expect(screen.getByText(/A critical error has occurred. Please refresh the page or contact support./i)).toBeInTheDocument()
    })

    it("should display server critical error", () => {
      const serverError = new AppError(
        "Server crash",
        ErrorType.SERVER,
        ErrorSeverity.CRITICAL,
        "SERVER_CRITICAL_ERROR",
        "Critical server error occurred."
      )

      render(<CriticalError {...mockProps} error={serverError} />)

      expect(screen.getByText(/A critical error has occurred. Please refresh the page or contact support./i)).toBeInTheDocument()
    })
  })

  describe("Styling", () => {
    it("should have full screen height", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const mainContainer = container.querySelector(".min-h-screen")
      expect(mainContainer).toBeInTheDocument()
    })

    it("should center content", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const centerContainer = container.querySelector(".flex.items-center.justify-center")
      expect(centerContainer).toBeInTheDocument()
    })

    it("should have proper card styling", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const card = container.querySelector(".bg-white.rounded-lg.shadow-lg")
      expect(card).toBeInTheDocument()
    })

    it("should have text-center alignment", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const centeredContent = container.querySelector(".text-center")
      expect(centeredContent).toBeInTheDocument()
    })

    it("should have red refresh button", () => {
      render(<CriticalError {...mockProps} />)

      const refreshButton = screen.getByText("Refresh Page")
      expect(refreshButton).toHaveClass("bg-red-600", "text-white")
    })

    it("should have gray report button", () => {
      render(<CriticalError {...mockProps} />)

      const reportButton = screen.getByText("Report Error")
      expect(reportButton).toHaveClass("bg-gray-600", "text-white")
    })

    it("should apply hover effects", () => {
      render(<CriticalError {...mockProps} />)

      const refreshButton = screen.getByText("Refresh Page")
      const reportButton = screen.getByText("Report Error")

      expect(refreshButton).toHaveClass("hover:bg-red-700")
      expect(reportButton).toHaveClass("hover:bg-gray-700")
    })

    it("should have transition effects", () => {
      render(<CriticalError {...mockProps} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveClass("transition-colors")
      })
    })

    it("should have large emoji", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const emoji = container.querySelector(".text-6xl")
      expect(emoji).toBeInTheDocument()
      expect(emoji).toHaveTextContent("🚨")
    })
  })

  describe("Layout", () => {
    it("should use proper spacing between buttons", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const buttonContainer = container.querySelector(".space-y-2")
      expect(buttonContainer).toBeInTheDocument()
    })

    it("should have proper padding", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const card = container.querySelector(".p-6")
      expect(card).toBeInTheDocument()
    })

    it("should render buttons in correct order", () => {
      render(<CriticalError {...mockProps} />)

      const buttons = screen.getAllByRole("button")
      expect(buttons[0]).toHaveTextContent("Refresh Page")
      expect(buttons[1]).toHaveTextContent("Report Error")
    })

    it("should have proper margins", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const emojiMargin = container.querySelector(".mb-4")
      expect(emojiMargin).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("should render all buttons as button elements", () => {
      render(<CriticalError {...mockProps} />)

      const refreshButton = screen.getByText("Refresh Page")
      const reportButton = screen.getByText("Report Error")

      expect(refreshButton.tagName).toBe("BUTTON")
      expect(reportButton.tagName).toBe("BUTTON")
    })

    it("should have semantic HTML structure", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const heading = container.querySelector("h1")
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent("Critical Error")
    })

    it("should display critical information in accessible format", () => {
      render(<CriticalError {...mockProps} />)

      expect(screen.getByRole("heading", { name: /Critical Error/i })).toBeInTheDocument()
    })

    it("should have proper heading hierarchy", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const h1 = container.querySelector("h1")
      expect(h1).toBeInTheDocument()
      expect(h1).toHaveClass("text-2xl", "font-bold")
    })

    it("should have full width buttons", () => {
      render(<CriticalError {...mockProps} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveClass("w-full")
      })
    })
  })

  describe("Responsive Design", () => {
    it("should have responsive padding", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const mainContainer = container.querySelector(".px-4")
      expect(mainContainer).toBeInTheDocument()
    })

    it("should have max width constraint", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const card = container.querySelector(".max-w-md")
      expect(card).toBeInTheDocument()
    })

    it("should take full width within constraints", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const card = container.querySelector(".w-full")
      expect(card).toBeInTheDocument()
    })
  })

  describe("Edge Cases", () => {
    it("should handle different error IDs", () => {
      const errorIds = [
        "critical_123",
        "err_critical_abc_def",
        "emergency_error_12345",
      ]

      errorIds.forEach(errorId => {
        const { unmount } = render(<CriticalError {...mockProps} errorId={errorId} />)

        expect(screen.getByText(`Error ID: ${errorId}`)).toBeInTheDocument()
        unmount()
      })
    })

    it("should handle rapid button clicks", () => {
      const onRetrySpy = vi.fn()
      render(<CriticalError {...mockProps} onRetry={onRetrySpy} />)

      const refreshButton = screen.getByText("Refresh Page")

      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        fireEvent.click(refreshButton)
      }

      expect(onRetrySpy).toHaveBeenCalledTimes(10)
    })

    it("should handle long error IDs", () => {
      render(<CriticalError
          {...mockProps}
          errorId="error_critical_1234567890_abcdefghijklmnopqrstuvwxyz_very_long_id"
        />)

      expect(screen.getByText(/Error ID: error_critical_1234567890/i)).toBeInTheDocument()
    })
  })

  describe("Component Integration", () => {
    it("should work with all critical error types", () => {
      const errorTypes = [ErrorType.DATABASE, ErrorType.SERVER, ErrorType.UNKNOWN]

      errorTypes.forEach(type => {
        const error = new AppError(
          `${type} critical error`,
          type,
          ErrorSeverity.CRITICAL,
          `${type}_CRITICAL_ERROR`,
          `Critical ${type} error message`
        )

        const { unmount } = render(<CriticalError {...mockProps} error={error} />)

        expect(screen.getByText("Critical Error")).toBeInTheDocument()
        unmount()
      })
    })

    it("should maintain functionality across re-renders", () => {
      const onRetrySpy = vi.fn()
      const { rerender } = render(<CriticalError {...mockProps} onRetry={onRetrySpy} />)

      const refreshButton = screen.getByText("Refresh Page")
      fireEvent.click(refreshButton)
      expect(onRetrySpy).toHaveBeenCalledTimes(1)

      rerender(<CriticalError {...mockProps} onRetry={onRetrySpy} />)

      fireEvent.click(refreshButton)
      expect(onRetrySpy).toHaveBeenCalledTimes(2)
    })

    it("should work independently of error prop changes", () => {
      const { rerender } = render(<CriticalError {...mockProps} />)

      expect(screen.getByText("Critical Error")).toBeInTheDocument()

      const newError = new AppError(
        "New critical error",
        ErrorType.SERVER,
        ErrorSeverity.CRITICAL,
        "NEW_CRITICAL_ERROR",
        "New critical error message"
      )

      rerender(<CriticalError {...mockProps} error={newError} />)

      expect(screen.getByText("Critical Error")).toBeInTheDocument()
    })
  })

  describe("Visual Hierarchy", () => {
    it("should have proper font sizes", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const emoji = container.querySelector(".text-6xl")
      const heading = container.querySelector(".text-2xl")
      const errorId = container.querySelector(".text-xs")

      expect(emoji).toBeInTheDocument()
      expect(heading).toBeInTheDocument()
      expect(errorId).toBeInTheDocument()
    })

    it("should have proper text colors", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const heading = container.querySelector(".text-gray-900")
      const description = container.querySelector(".text-gray-600")
      const errorId = container.querySelector(".text-gray-500")

      expect(heading).toBeInTheDocument()
      expect(description).toBeInTheDocument()
      expect(errorId).toBeInTheDocument()
    })

    it("should emphasize the heading", () => {
      const { container } = render(<CriticalError {...mockProps} />)

      const heading = container.querySelector("h1")
      expect(heading).toHaveClass("text-2xl", "font-bold", "text-gray-900")
    })
  })

  describe("User Guidance", () => {
    it("should provide clear action instructions", () => {
      render(<CriticalError {...mockProps} />)

      expect(screen.getByText(/A critical error has occurred. Please refresh the page or contact support./i)).toBeInTheDocument()
    })

    it("should suggest both refresh and contact support", () => {
      render(<CriticalError {...mockProps} />)

      const message = screen.getByText(/refresh the page or contact support/i)
      expect(message).toBeInTheDocument()
    })

    it("should provide actionable buttons", () => {
      render(<CriticalError {...mockProps} />)

      const refreshButton = screen.getByText("Refresh Page")
      const reportButton = screen.getByText("Report Error")

      expect(refreshButton).toBeInTheDocument()
      expect(reportButton).toBeInTheDocument()
    })
  })
})
