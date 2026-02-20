import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import LazyRoute from "./LazyRoute"

// Mock component for testing
const MockComponent = () => <div data-testid="mock-component">Mock Component</div>

// Mock dynamic import
const mockImportFn = vi.fn(() => Promise.resolve({ default: MockComponent }))

describe("LazyRoute", () => {
  it("renders fallback while loading", () => {
    render(<LazyRoute
        importFn={mockImportFn}
        fallback={<div data-testid="loading">Loading...</div>}
      />)

    expect(screen.getByTestId("loading")).toBeInTheDocument()
  })

  it("renders default fallback when none provided", () => {
    render(<LazyRoute importFn={mockImportFn} />)

    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const { container } = render(<LazyRoute importFn={mockImportFn} className="custom-class" />)

    expect(container.firstChild).toHaveClass("custom-class")
  })

  it("calls import function", () => {
    render(<LazyRoute importFn={mockImportFn} />)

    expect(mockImportFn).toHaveBeenCalled()
  })
})
