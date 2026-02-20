import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppError, ErrorSeverity, ErrorType } from "~/utils/errorHandling"

import ComponentError from "./ComponentError"

describe("ComponentError", () => {
  const mockError = new AppError(
    "Test error",
    ErrorType.CLIENT,
    ErrorSeverity.MEDIUM,
    "TEST_ERROR",
    "Something went wrong. Please try again."
  )

  const mockProps = {
    error: mockError,
    errorId: "error_123456",
    onRetry: vi.fn(),
    onReportError: vi.fn(),
  }

  describe("Rendering", () => {
    it("should render component error UI", () => {
      render(<ComponentError {...mockProps} />)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
    })

    it("should display error message", () => {
      render(<ComponentError {...mockProps} />)

      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument()
    })

    it("should display error ID", () => {
      render(<ComponentError {...mockProps} />)

      expect(screen.getByText("Error ID: error_123456")).toBeInTheDocument()
    })

    it("should render emoji warning icon", () => {
      render(<ComponentError {...mockProps} />)

      expect(screen.getByText("⚠️")).toBeInTheDocument()
    })

    it("should render retry button", () => {
      render(<ComponentError {...mockProps} />)

      expect(screen.getByText("Retry")).toBeInTheDocument()
    })

    it("should render report button", () => {
      render(<ComponentError {...mockProps} />)

      expect(screen.getByText("Report")).toBeInTheDocument()
    })
  })

  describe("Interactions", () => {
    it("should call onRetry when retry button is clicked", () => {
      const onRetrySpy = vi.fn()
      render(<ComponentError {...mockProps} onRetry={onRetrySpy} />)

      const retryButton = screen.getByText("Retry")
      fireEvent.click(retryButton)

      expect(onRetrySpy).toHaveBeenCalledTimes(1)
    })

    it("should call onReportError when report button is clicked", () => {
      const onReportErrorSpy = vi.fn()
      render(<ComponentError {...mockProps} onReportError={onReportErrorSpy} />)

      const reportButton = screen.getByText("Report")
      fireEvent.click(reportButton)

      expect(onReportErrorSpy).toHaveBeenCalledTimes(1)
    })

    it("should handle multiple retry clicks", () => {
      const onRetrySpy = vi.fn()
      render(<ComponentError {...mockProps} onRetry={onRetrySpy} />)

      const retryButton = screen.getByText("Retry")
      fireEvent.click(retryButton)
      fireEvent.click(retryButton)
      fireEvent.click(retryButton)

      expect(onRetrySpy).toHaveBeenCalledTimes(3)
    })

    it("should handle multiple report clicks", () => {
      const onReportErrorSpy = vi.fn()
      render(<ComponentError {...mockProps} onReportError={onReportErrorSpy} />)

      const reportButton = screen.getByText("Report")
      fireEvent.click(reportButton)
      fireEvent.click(reportButton)

      expect(onReportErrorSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe("Different Error Types", () => {
    it("should display validation error message", () => {
      const validationError = new AppError(
        "Validation failed",
        ErrorType.VALIDATION,
        ErrorSeverity.LOW,
        "VALIDATION_ERROR",
        "Please check your input and try again."
      )

      render(<ComponentError {...mockProps} error={validationError} />)

      expect(screen.getByText("Please check your input and try again.")).toBeInTheDocument()
    })

    it("should display authentication error message", () => {
      const authError = new AppError(
        "Authentication failed",
        ErrorType.AUTHENTICATION,
        ErrorSeverity.MEDIUM,
        "AUTH_ERROR",
        "Please sign in to continue."
      )

      render(<ComponentError {...mockProps} error={authError} />)

      expect(screen.getByText("Please sign in to continue.")).toBeInTheDocument()
    })

    it("should display database error message", () => {
      const dbError = new AppError(
        "Database connection failed",
        ErrorType.DATABASE,
        ErrorSeverity.HIGH,
        "DB_ERROR",
        "Database error. Please try again later."
      )

      render(<ComponentError {...mockProps} error={dbError} />)

      expect(screen.getByText("Database error. Please try again later.")).toBeInTheDocument()
    })

    it("should display network error message", () => {
      const networkError = new AppError(
        "Network request failed",
        ErrorType.NETWORK,
        ErrorSeverity.MEDIUM,
        "NETWORK_ERROR",
        "Network error. Please check your connection and try again."
      )

      render(<ComponentError {...mockProps} error={networkError} />)

      expect(screen.getByText("Network error. Please check your connection and try again.")).toBeInTheDocument()
    })
  })

  describe("Styling", () => {
    it("should have correct container styling classes", () => {
      const { container } = render(<ComponentError {...mockProps} />)

      const errorContainer = container.querySelector(".bg-red-50")
      expect(errorContainer).toBeInTheDocument()
      expect(errorContainer).toHaveClass(
        "border",
        "border-red-200",
        "rounded-lg",
        "p-4"
      )
    })

    it("should have correct heading styling", () => {
      render(<ComponentError {...mockProps} />)

      const heading = screen.getByText("Component Error")
      expect(heading.tagName).toBe("H3")
      expect(heading).toHaveClass("text-sm", "font-medium", "text-red-800")
    })

    it("should have correct button styling for retry button", () => {
      render(<ComponentError {...mockProps} />)

      const retryButton = screen.getByText("Retry")
      expect(retryButton).toHaveClass(
        "text-sm",
        "bg-red-100",
        "text-red-800",
        "px-3",
        "py-1",
        "rounded"
      )
    })

    it("should have correct button styling for report button", () => {
      render(<ComponentError {...mockProps} />)

      const reportButton = screen.getByText("Report")
      expect(reportButton).toHaveClass(
        "text-sm",
        "bg-gray-100",
        "text-gray-700",
        "px-3",
        "py-1",
        "rounded"
      )
    })

    it("should apply hover effects classes", () => {
      render(<ComponentError {...mockProps} />)

      const retryButton = screen.getByText("Retry")
      const reportButton = screen.getByText("Report")

      expect(retryButton).toHaveClass("hover:bg-red-200")
      expect(reportButton).toHaveClass("hover:bg-gray-200")
    })
  })

  describe("Accessibility", () => {
    it("should render buttons as button elements", () => {
      render(<ComponentError {...mockProps} />)

      const retryButton = screen.getByText("Retry")
      const reportButton = screen.getByText("Report")

      expect(retryButton.tagName).toBe("BUTTON")
      expect(reportButton.tagName).toBe("BUTTON")
    })

    it("should have semantic HTML structure", () => {
      const { container } = render(<ComponentError {...mockProps} />)

      const heading = container.querySelector("h3")
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent("Component Error")
    })

    it("should display error information in accessible format", () => {
      render(<ComponentError {...mockProps} />)

      expect(screen.getByText("Component Error")).toBeInTheDocument()
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      expect(screen.getByText(/Error ID:/i)).toBeInTheDocument()
    })
  })

  describe("Edge Cases", () => {
    it("should handle long error messages", () => {
      const longError = new AppError(
        "Very long error message",
        ErrorType.CLIENT,
        ErrorSeverity.MEDIUM,
        "LONG_ERROR",
        "This is a very long error message that might wrap to multiple lines and should still be displayed correctly without breaking the layout or causing issues."
      )

      render(<ComponentError {...mockProps} error={longError} />)

      expect(screen.getByText(/This is a very long error message/i)).toBeInTheDocument()
    })

    it("should handle long error IDs", () => {
      render(<ComponentError {...mockProps} errorId="error_1234567890_abcdefghijklmnop" />)

      expect(screen.getByText("Error ID: error_1234567890_abcdefghijklmnop")).toBeInTheDocument()
    })

    it("should handle error with special characters in message", () => {
      const specialCharError = new AppError(
        'Error with <special> & "characters"',
        ErrorType.CLIENT,
        ErrorSeverity.MEDIUM,
        "SPECIAL_CHAR_ERROR",
        'Error message with <special> & "characters"'
      )

      render(<ComponentError {...mockProps} error={specialCharError} />)

      expect(screen.getByText('Error message with <special> & "characters"')).toBeInTheDocument()
    })

    it("should handle rapid button clicks", () => {
      const onRetrySpy = vi.fn()
      render(<ComponentError {...mockProps} onRetry={onRetrySpy} />)

      const retryButton = screen.getByText("Retry")

      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        fireEvent.click(retryButton)
      }

      expect(onRetrySpy).toHaveBeenCalledTimes(10)
    })
  })

  describe("Layout", () => {
    it("should use flexbox layout", () => {
      const { container } = render(<ComponentError {...mockProps} />)

      const flexContainer = container.querySelector(".flex")
      expect(flexContainer).toBeInTheDocument()
    })

    it("should have proper spacing between elements", () => {
      const { container } = render(<ComponentError {...mockProps} />)

      const buttonContainer = container.querySelector(".space-x-2")
      expect(buttonContainer).toBeInTheDocument()
    })

    it("should render icon in proper position", () => {
      const { container } = render(<ComponentError {...mockProps} />)

      const iconContainer = container.querySelector(".flex-shrink-0")
      expect(iconContainer).toBeInTheDocument()
      expect(iconContainer).toHaveTextContent("⚠️")
    })
  })

  describe("Component Integration", () => {
    it("should work with different error ID formats", () => {
      const errorIds = [
        "error_123",
        "err_abc_def",
        "custom_error_id_format",
        "12345",
      ]

      errorIds.forEach(errorId => {
        const { unmount } = render(<ComponentError {...mockProps} errorId={errorId} />)

        expect(screen.getByText(`Error ID: ${errorId}`)).toBeInTheDocument()
        unmount()
      })
    })

    it("should maintain functionality across re-renders", () => {
      const onRetrySpy = vi.fn()
      const { rerender } = render(<ComponentError {...mockProps} onRetry={onRetrySpy} />)

      const retryButton = screen.getByText("Retry")
      fireEvent.click(retryButton)
      expect(onRetrySpy).toHaveBeenCalledTimes(1)

      rerender(<ComponentError {...mockProps} onRetry={onRetrySpy} />)

      fireEvent.click(retryButton)
      expect(onRetrySpy).toHaveBeenCalledTimes(2)
    })
  })
})
