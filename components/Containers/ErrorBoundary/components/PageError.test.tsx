import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppError, ErrorSeverity, ErrorType } from "~/utils/errorHandling"

import PageError from "./PageError"

describe("PageError", () => {
  const mockError = new AppError(
    "Page error occurred",
    ErrorType.SERVER,
    ErrorSeverity.HIGH,
    "PAGE_ERROR",
    "Something went wrong. Please try again."
  )

  const mockProps = {
    error: mockError,
    errorId: "error_page_123456",
    onRetry: vi.fn(),
    onReportError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.history.back
    window.history.back = vi.fn()
  })

  describe("Rendering", () => {
    it("should render page error UI", () => {
      render(<PageError {...mockProps} />)

      expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    })

    it("should display error message", () => {
      render(<PageError {...mockProps} />)

      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument()
    })

    it("should display error ID", () => {
      render(<PageError {...mockProps} />)

      expect(screen.getByText("Error ID: error_page_123456")).toBeInTheDocument()
    })

    it("should render emoji warning icon", () => {
      render(<PageError {...mockProps} />)

      expect(screen.getByText("⚠️")).toBeInTheDocument()
    })

    it("should render try again button", () => {
      render(<PageError {...mockProps} />)

      expect(screen.getByText("Try Again")).toBeInTheDocument()
    })

    it("should render go back button", () => {
      render(<PageError {...mockProps} />)

      expect(screen.getByText("Go Back")).toBeInTheDocument()
    })

    it("should render report issue button", () => {
      render(<PageError {...mockProps} />)

      expect(screen.getByText("Report Issue")).toBeInTheDocument()
    })
  })

  describe("Interactions", () => {
    it("should call onRetry when try again button is clicked", () => {
      const onRetrySpy = vi.fn()
      render(<PageError {...mockProps} onRetry={onRetrySpy} />)

      const tryAgainButton = screen.getByText("Try Again")
      fireEvent.click(tryAgainButton)

      expect(onRetrySpy).toHaveBeenCalledTimes(1)
    })

    it("should call window.history.back when go back button is clicked", () => {
      render(<PageError {...mockProps} />)

      const goBackButton = screen.getByText("Go Back")
      fireEvent.click(goBackButton)

      expect(window.history.back).toHaveBeenCalledTimes(1)
    })

    it("should call onReportError when report issue button is clicked", () => {
      const onReportErrorSpy = vi.fn()
      render(<PageError {...mockProps} onReportError={onReportErrorSpy} />)

      const reportButton = screen.getByText("Report Issue")
      fireEvent.click(reportButton)

      expect(onReportErrorSpy).toHaveBeenCalledTimes(1)
    })

    it("should handle multiple button clicks", () => {
      const onRetrySpy = vi.fn()
      const onReportErrorSpy = vi.fn()

      render(<PageError
          {...mockProps}
          onRetry={onRetrySpy}
          onReportError={onReportErrorSpy}
        />)

      const tryAgainButton = screen.getByText("Try Again")
      const reportButton = screen.getByText("Report Issue")

      fireEvent.click(tryAgainButton)
      fireEvent.click(reportButton)
      fireEvent.click(tryAgainButton)

      expect(onRetrySpy).toHaveBeenCalledTimes(2)
      expect(onReportErrorSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe("Different Error Types", () => {
    it("should display server error message", () => {
      const serverError = new AppError(
        "Server error",
        ErrorType.SERVER,
        ErrorSeverity.HIGH,
        "SERVER_ERROR",
        "Server error. Please try again later."
      )

      render(<PageError {...mockProps} error={serverError} />)

      expect(screen.getByText("Server error. Please try again later.")).toBeInTheDocument()
    })

    it("should display not found error message", () => {
      const notFoundError = new AppError(
        "Page not found",
        ErrorType.NOT_FOUND,
        ErrorSeverity.LOW,
        "NOT_FOUND_ERROR",
        "The requested resource was not found."
      )

      render(<PageError {...mockProps} error={notFoundError} />)

      expect(screen.getByText("The requested resource was not found.")).toBeInTheDocument()
    })

    it("should display authorization error message", () => {
      const authzError = new AppError(
        "Access denied",
        ErrorType.AUTHORIZATION,
        ErrorSeverity.MEDIUM,
        "AUTHZ_ERROR",
        "You do not have permission to perform this action."
      )

      render(<PageError {...mockProps} error={authzError} />)

      expect(screen.getByText("You do not have permission to perform this action.")).toBeInTheDocument()
    })
  })

  describe("Styling", () => {
    it("should have full screen height", () => {
      const { container } = render(<PageError {...mockProps} />)

      const mainContainer = container.querySelector(".min-h-screen")
      expect(mainContainer).toBeInTheDocument()
    })

    it("should center content", () => {
      const { container } = render(<PageError {...mockProps} />)

      const centerContainer = container.querySelector(".flex.items-center.justify-center")
      expect(centerContainer).toBeInTheDocument()
    })

    it("should have proper card styling", () => {
      const { container } = render(<PageError {...mockProps} />)

      const card = container.querySelector(".bg-white.rounded-lg.shadow-lg")
      expect(card).toBeInTheDocument()
    })

    it("should have correct button colors", () => {
      render(<PageError {...mockProps} />)

      const tryAgainButton = screen.getByText("Try Again")
      const goBackButton = screen.getByText("Go Back")
      const reportButton = screen.getByText("Report Issue")

      expect(tryAgainButton).toHaveClass("bg-blue-600", "text-white")
      expect(goBackButton).toHaveClass("bg-gray-600", "text-white")
      expect(reportButton).toHaveClass("bg-gray-200", "text-gray-700")
    })

    it("should apply hover effects", () => {
      render(<PageError {...mockProps} />)

      const tryAgainButton = screen.getByText("Try Again")
      const goBackButton = screen.getByText("Go Back")
      const reportButton = screen.getByText("Report Issue")

      expect(tryAgainButton).toHaveClass("hover:bg-blue-700")
      expect(goBackButton).toHaveClass("hover:bg-gray-700")
      expect(reportButton).toHaveClass("hover:bg-gray-300")
    })

    it("should have transition effects", () => {
      render(<PageError {...mockProps} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveClass("transition-colors")
      })
    })
  })

  describe("Layout", () => {
    it("should use proper spacing between buttons", () => {
      const { container } = render(<PageError {...mockProps} />)

      const buttonContainer = container.querySelector(".space-y-3")
      expect(buttonContainer).toBeInTheDocument()
    })

    it("should have proper padding", () => {
      const { container } = render(<PageError {...mockProps} />)

      const card = container.querySelector(".p-6")
      expect(card).toBeInTheDocument()
    })

    it("should render buttons in correct order", () => {
      render(<PageError {...mockProps} />)

      const buttons = screen.getAllByRole("button")
      expect(buttons[0]).toHaveTextContent("Try Again")
      expect(buttons[1]).toHaveTextContent("Go Back")
      expect(buttons[2]).toHaveTextContent("Report Issue")
    })

    it("should center text elements", () => {
      const { container } = render(<PageError {...mockProps} />)

      const textCenter = container.querySelector(".text-center")
      expect(textCenter).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("should render all buttons as button elements", () => {
      render(<PageError {...mockProps} />)

      const tryAgainButton = screen.getByText("Try Again")
      const goBackButton = screen.getByText("Go Back")
      const reportButton = screen.getByText("Report Issue")

      expect(tryAgainButton.tagName).toBe("BUTTON")
      expect(goBackButton.tagName).toBe("BUTTON")
      expect(reportButton.tagName).toBe("BUTTON")
    })

    it("should have semantic HTML structure", () => {
      const { container } = render(<PageError {...mockProps} />)

      const heading = container.querySelector("h1")
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent("Something went wrong")
    })

    it("should display error information in accessible format", () => {
      render(<PageError {...mockProps} />)

      expect(screen.getByRole("heading", { name: /Something went wrong/i })).toBeInTheDocument()
    })

    it("should have proper heading hierarchy", () => {
      const { container } = render(<PageError {...mockProps} />)

      const h1 = container.querySelector("h1")
      expect(h1).toBeInTheDocument()
      expect(h1).toHaveClass("text-xl", "font-bold")
    })
  })

  describe("Responsive Design", () => {
    it("should have responsive padding", () => {
      const { container } = render(<PageError {...mockProps} />)

      const mainContainer = container.querySelector(".px-4")
      expect(mainContainer).toBeInTheDocument()
    })

    it("should have max width constraint", () => {
      const { container } = render(<PageError {...mockProps} />)

      const card = container.querySelector(".max-w-lg")
      expect(card).toBeInTheDocument()
    })

    it("should take full width within constraints", () => {
      const { container } = render(<PageError {...mockProps} />)

      const card = container.querySelector(".w-full")
      expect(card).toBeInTheDocument()
    })
  })

  describe("Edge Cases", () => {
    it("should handle very long error messages", () => {
      const longError = new AppError(
        "Long error",
        ErrorType.SERVER,
        ErrorSeverity.HIGH,
        "LONG_ERROR",
        "This is a very long error message that contains multiple sentences and should wrap properly without breaking the layout or causing horizontal scroll. The error message should remain readable and accessible even when it spans multiple lines."
      )

      render(<PageError {...mockProps} error={longError} />)

      expect(screen.getByText(/This is a very long error message/i)).toBeInTheDocument()
    })

    it("should handle error messages with special characters", () => {
      const specialError = new AppError(
        "Special error",
        ErrorType.SERVER,
        ErrorSeverity.HIGH,
        "SPECIAL_ERROR",
        'Error: <Component> failed with "quotes" & ampersands'
      )

      render(<PageError {...mockProps} error={specialError} />)

      expect(screen.getByText(/Error: <Component> failed with "quotes" & ampersands/i)).toBeInTheDocument()
    })

    it("should handle rapid button clicks", () => {
      const onRetrySpy = vi.fn()
      render(<PageError {...mockProps} onRetry={onRetrySpy} />)

      const tryAgainButton = screen.getByText("Try Again")

      // Simulate rapid clicks
      for (let i = 0; i < 5; i++) {
        fireEvent.click(tryAgainButton)
      }

      expect(onRetrySpy).toHaveBeenCalledTimes(5)
    })

    it("should handle long error IDs", () => {
      render(<PageError
          {...mockProps}
          errorId="error_page_1234567890_abcdefghijklmnopqrstuvwxyz"
        />)

      expect(screen.getByText(/Error ID: error_page_1234567890/i)).toBeInTheDocument()
    })
  })

  describe("Component Integration", () => {
    it("should work with all error types", () => {
      const errorTypes = [
        ErrorType.SERVER,
        ErrorType.DATABASE,
        ErrorType.NETWORK,
        ErrorType.NOT_FOUND,
        ErrorType.AUTHORIZATION,
      ]

      errorTypes.forEach(type => {
        const error = new AppError(
          `${type} error`,
          type,
          ErrorSeverity.MEDIUM,
          `${type}_ERROR`,
          `${type} error message`
        )

        const { unmount } = render(<PageError {...mockProps} error={error} />)

        expect(screen.getByText(`${type} error message`)).toBeInTheDocument()
        unmount()
      })
    })

    it("should maintain state across re-renders", () => {
      const onRetrySpy = vi.fn()
      const { rerender } = render(<PageError {...mockProps} onRetry={onRetrySpy} />)

      const tryAgainButton = screen.getByText("Try Again")
      fireEvent.click(tryAgainButton)
      expect(onRetrySpy).toHaveBeenCalledTimes(1)

      rerender(<PageError {...mockProps} onRetry={onRetrySpy} />)

      fireEvent.click(tryAgainButton)
      expect(onRetrySpy).toHaveBeenCalledTimes(2)
    })
  })

  describe("Visual Hierarchy", () => {
    it("should have proper font sizes", () => {
      const { container } = render(<PageError {...mockProps} />)

      const emoji = container.querySelector(".text-4xl")
      const heading = container.querySelector(".text-xl")
      const errorId = container.querySelector(".text-xs")

      expect(emoji).toBeInTheDocument()
      expect(heading).toBeInTheDocument()
      expect(errorId).toBeInTheDocument()
    })

    it("should have proper margins and spacing", () => {
      const { container } = render(<PageError {...mockProps} />)

      const emojiContainer = container.querySelector(".mb-4")
      const headingContainer = container.querySelector(".mb-2")

      expect(emojiContainer).toBeInTheDocument()
      expect(headingContainer).toBeInTheDocument()
    })
  })
})
