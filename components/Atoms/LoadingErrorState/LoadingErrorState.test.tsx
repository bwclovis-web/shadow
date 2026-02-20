import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import LoadingErrorState from "./LoadingErrorState"

// Mock ErrorDisplay component
vi.mock("~/components/Containers/ErrorDisplay", () => ({
  default: ({
    error,
    title,
    showDetails,
    onRetry,
    onDismiss,
    variant,
    className,
  }: any) => (
    <div data-testid="error-display" className={className}>
      <div data-testid="error-message">{error?.message || error}</div>
      {title && <div data-testid="error-title">{title}</div>}
      {showDetails && <div data-testid="error-details">Error details</div>}
      {onRetry && (
        <button data-testid="retry-button" onClick={onRetry}>
          Try Again
        </button>
      )}
      {onDismiss && (
        <button data-testid="dismiss-button" onClick={onDismiss}>
          Dismiss
        </button>
      )}
      <div data-testid="error-variant">{variant}</div>
    </div>
  ),
}))

describe("LoadingErrorState", () => {
  describe("Loading state", () => {
    it("should render loading spinner when isLoading is true", () => {
      render(<LoadingErrorState isLoading />)

      const spinner = screen
        .getByText("Loading...")
        .parentElement?.querySelector(".animate-spin")
      expect(spinner).toBeInTheDocument()
      expect(screen.getByText("Loading...")).toBeInTheDocument()
    })

    it("should render custom loading text", () => {
      render(<LoadingErrorState isLoading loadingText="Custom loading text" />)

      expect(screen.getByText("Custom loading text")).toBeInTheDocument()
    })

    it("should apply custom className to loading container", () => {
      render(<LoadingErrorState isLoading className="custom-loading" />)

      const container = screen.getByText("Loading...").closest("div")?.parentElement
      expect(container).toHaveClass("custom-loading")
    })

    it("should have proper loading spinner styling", () => {
      render(<LoadingErrorState isLoading />)

      const spinner = screen
        .getByText("Loading...")
        .parentElement?.querySelector(".animate-spin")
      expect(spinner).toHaveClass(
        "animate-spin",
        "rounded-full",
        "h-8",
        "w-8",
        "border-b-2",
        "border-blue-600"
      )
    })
  })

  describe("Error state", () => {
    it("should render error display when error is provided", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error} />)

      expect(screen.getByTestId("error-display")).toBeInTheDocument()
      expect(screen.getByTestId("error-message")).toHaveTextContent("Test error")
    })

    it("should render error display with string error", () => {
      render(<LoadingErrorState error="String error" />)

      expect(screen.getByTestId("error-display")).toBeInTheDocument()
      expect(screen.getByTestId("error-message")).toHaveTextContent("String error")
    })

    it("should pass error title to ErrorDisplay", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error} errorTitle="Custom Error Title" />)

      expect(screen.getByTestId("error-title")).toHaveTextContent("Custom Error Title")
    })

    it("should pass showErrorDetails to ErrorDisplay", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error} showErrorDetails />)

      expect(screen.getByTestId("error-details")).toBeInTheDocument()
    })

    it("should pass onRetry callback to ErrorDisplay", () => {
      const error = new Error("Test error")
      const onRetry = vi.fn()
      render(<LoadingErrorState error={error} onRetry={onRetry} />)

      const retryButton = screen.getByTestId("retry-button")
      expect(retryButton).toBeInTheDocument()

      fireEvent.click(retryButton)
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it("should pass onDismiss callback to ErrorDisplay", () => {
      const error = new Error("Test error")
      const onDismiss = vi.fn()
      render(<LoadingErrorState error={error} onDismiss={onDismiss} />)

      const dismissButton = screen.getByTestId("dismiss-button")
      expect(dismissButton).toBeInTheDocument()

      fireEvent.click(dismissButton)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it("should pass card variant to ErrorDisplay", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error} />)

      expect(screen.getByTestId("error-variant")).toHaveTextContent("card")
    })

    it("should apply custom className to error container", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error} className="custom-error" />)

      const errorContainer = screen.getByTestId("error-display").parentElement
      expect(errorContainer).toHaveClass("custom-error")
    })
  })

  describe("Children rendering", () => {
    it("should render children when neither loading nor error", () => {
      render(<LoadingErrorState>
          <div data-testid="children">Children content</div>
        </LoadingErrorState>)

      expect(screen.getByTestId("children")).toBeInTheDocument()
      expect(screen.getByTestId("children")).toHaveTextContent("Children content")
    })

    it("should not render children when loading", () => {
      render(<LoadingErrorState isLoading>
          <div data-testid="children">Children content</div>
        </LoadingErrorState>)

      expect(screen.queryByTestId("children")).not.toBeInTheDocument()
    })

    it("should not render children when error", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error}>
          <div data-testid="children">Children content</div>
        </LoadingErrorState>)

      expect(screen.queryByTestId("children")).not.toBeInTheDocument()
    })
  })

  describe("State priority", () => {
    it("should prioritize error over loading", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState isLoading error={error} />)

      expect(screen.getByTestId("error-display")).toBeInTheDocument()
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    it("should prioritize error over children", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error}>
          <div data-testid="children">Children content</div>
        </LoadingErrorState>)

      expect(screen.getByTestId("error-display")).toBeInTheDocument()
      expect(screen.queryByTestId("children")).not.toBeInTheDocument()
    })

    it("should prioritize loading over children", () => {
      render(<LoadingErrorState isLoading>
          <div data-testid="children">Children content</div>
        </LoadingErrorState>)

      expect(screen.getByText("Loading...")).toBeInTheDocument()
      expect(screen.queryByTestId("children")).not.toBeInTheDocument()
    })
  })

  describe("Default values", () => {
    it("should use default loading text", () => {
      render(<LoadingErrorState isLoading />)

      expect(screen.getByText("Loading...")).toBeInTheDocument()
    })

    it("should not show error details by default", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error} />)

      expect(screen.queryByTestId("error-details")).not.toBeInTheDocument()
    })

    it("should not show validation icon by default", () => {
      const error = new Error("Test error")
      render(<LoadingErrorState error={error} />)

      // ErrorDisplay should not have validation icon by default
      expect(screen.getByTestId("error-display")).toBeInTheDocument()
    })
  })

  describe("Edge cases", () => {
    it("should handle null error", () => {
      render(<LoadingErrorState error={null} />)

      expect(screen.queryByTestId("error-display")).not.toBeInTheDocument()
    })

    it("should handle undefined error", () => {
      render(<LoadingErrorState error={undefined} />)

      expect(screen.queryByTestId("error-display")).not.toBeInTheDocument()
    })

    it("should handle empty string error", () => {
      render(<LoadingErrorState error="" />)

      expect(screen.queryByTestId("error-display")).not.toBeInTheDocument()
    })

    it("should handle false loading state", () => {
      render(<LoadingErrorState isLoading={false} />)

      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    it("should handle complex error objects", () => {
      const complexError = {
        message: "Complex error",
        code: "COMPLEX_ERROR",
        details: { field: "test" },
      }
      render(<LoadingErrorState error={complexError} />)

      expect(screen.getByTestId("error-display")).toBeInTheDocument()
    })
  })
})
