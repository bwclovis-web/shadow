import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ValidationMessage from "./ValidationMessage"

describe("ValidationMessage", () => {
  describe("Rendering", () => {
    it("should render error message", () => {
      const { container } = render(<ValidationMessage error="This is an error" />)

      expect(screen.getByText("This is an error")).toBeInTheDocument()
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument()
      // Check for SVG icon (react-icons render as SVG)
      expect(container.querySelector("svg")).toBeInTheDocument()
    })

    it("should render success message", () => {
      const { container } = render(<ValidationMessage success="This is a success" />)

      expect(screen.getByText("This is a success")).toBeInTheDocument()
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument()
      // Check for SVG icon
      expect(container.querySelector("svg")).toBeInTheDocument()
    })

    it("should render warning message", () => {
      const { container } = render(<ValidationMessage warning="This is a warning" />)

      expect(screen.getByText("This is a warning")).toBeInTheDocument()
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument()
      // Check for SVG icon
      expect(container.querySelector("svg")).toBeInTheDocument()
    })

    it("should render info message", () => {
      const { container } = render(<ValidationMessage info="This is info" />)

      expect(screen.getByText("This is info")).toBeInTheDocument()
      expect(container.querySelector('[role="alert"]')).toBeInTheDocument()
      // Check for SVG icon
      expect(container.querySelector("svg")).toBeInTheDocument()
    })

    it("should not render when no message provided", () => {
      const { container } = render(<ValidationMessage />)

      expect(container.firstChild).toBeNull()
    })

    it("should prioritize error over other message types", () => {
      render(<ValidationMessage
          error="Error message"
          success="Success message"
          warning="Warning message"
          info="Info message"
        />)

      expect(screen.getByText("Error message")).toBeInTheDocument()
      expect(screen.queryByText("Success message")).not.toBeInTheDocument()
      expect(screen.queryByText("Warning message")).not.toBeInTheDocument()
      expect(screen.queryByText("Info message")).not.toBeInTheDocument()
    })

    it("should prioritize success over warning and info", () => {
      render(<ValidationMessage
          success="Success message"
          warning="Warning message"
          info="Info message"
        />)

      expect(screen.getByText("Success message")).toBeInTheDocument()
      expect(screen.queryByText("Warning message")).not.toBeInTheDocument()
      expect(screen.queryByText("Info message")).not.toBeInTheDocument()
    })

    it("should prioritize warning over info", () => {
      render(<ValidationMessage warning="Warning message" info="Info message" />)

      expect(screen.getByText("Warning message")).toBeInTheDocument()
      expect(screen.queryByText("Info message")).not.toBeInTheDocument()
    })
  })

  describe("Styling", () => {
    it("should apply error styling", () => {
      const { container } = render(<ValidationMessage error="Error message" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveClass("bg-red-50", "border-red-200", "text-red-800")
    })

    it("should apply success styling", () => {
      const { container } = render(<ValidationMessage success="Success message" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveClass("bg-green-50", "border-green-200", "text-green-800")
    })

    it("should apply warning styling", () => {
      const { container } = render(<ValidationMessage warning="Warning message" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveClass(
        "bg-yellow-50",
        "border-yellow-200",
        "text-yellow-800"
      )
    })

    it("should apply info styling", () => {
      const { container } = render(<ValidationMessage info="Info message" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveClass("bg-blue-50", "border-blue-200", "text-blue-800")
    })

    it("should apply custom className", () => {
      const { container } = render(<ValidationMessage error="Error message" className="custom-class" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveClass("custom-class")
    })
  })

  describe("Size variants", () => {
    it("should apply small size styling", () => {
      const { container } = render(<ValidationMessage error="Error message" size="sm" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveClass("text-xs", "px-2", "py-1")
    })

    it("should apply medium size styling (default)", () => {
      const { container } = render(<ValidationMessage error="Error message" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveClass("text-sm", "px-3", "py-2")
    })

    it("should apply large size styling", () => {
      const { container } = render(<ValidationMessage error="Error message" size="lg" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveClass("text-base", "px-4", "py-3")
    })
  })

  describe("Icon display", () => {
    it("should show icon by default", () => {
      const { container } = render(<ValidationMessage error="Error message" />)

      // Check for SVG icon (react-icons render as SVG elements)
      const svg = container.querySelector("svg")
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute("aria-hidden", "true")
    })

    it("should hide icon when showIcon is false", () => {
      const { container } = render(<ValidationMessage error="Error message" showIcon={false} />)

      // SVG icon should not be present
      const svg = container.querySelector("svg")
      expect(svg).not.toBeInTheDocument()
    })

    it("should apply correct icon color classes", () => {
      const { container } = render(<ValidationMessage error="Error message" />)

      const svg = container.querySelector("svg")
      expect(svg).toHaveClass("text-red-500")
    })

    it("should show correct icons for each type", () => {
      const { rerender, container } = render(<ValidationMessage error="Error" />)
      let svg = container.querySelector("svg")
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass("text-red-500")

      rerender(<ValidationMessage success="Success" />)
      svg = container.querySelector("svg")
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass("text-green-500")

      rerender(<ValidationMessage warning="Warning" />)
      svg = container.querySelector("svg")
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass("text-yellow-500")

      rerender(<ValidationMessage info="Info" />)
      svg = container.querySelector("svg")
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass("text-blue-500")
    })
  })

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      const { container } = render(<ValidationMessage error="Error message" />)

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toHaveAttribute("aria-live", "polite")
    })

    it("should have proper icon accessibility", () => {
      const { container } = render(<ValidationMessage error="Error message" />)

      // SVG icons should have aria-hidden attribute
      const svg = container.querySelector("svg")
      expect(svg).toHaveAttribute("aria-hidden", "true")
    })
  })

  describe("Edge cases", () => {
    it("should handle empty string messages", () => {
      const { container } = render(<ValidationMessage error="" />)

      expect(container.firstChild).toBeNull()
    })

    it("should handle null messages", () => {
      const { container } = render(<ValidationMessage error={null as any} />)

      expect(container.firstChild).toBeNull()
    })

    it("should handle undefined messages", () => {
      const { container } = render(<ValidationMessage error={undefined} />)

      expect(container.firstChild).toBeNull()
    })
  })
})
