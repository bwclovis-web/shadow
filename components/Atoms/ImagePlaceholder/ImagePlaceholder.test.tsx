import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ImagePlaceholder from "./ImagePlaceholder"

describe("ImagePlaceholder", () => {
  describe("Rendering", () => {
    it("should render skeleton variant by default", () => {
      const { container } = render(<ImagePlaceholder />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toBeInTheDocument()
      expect(placeholder).toHaveClass("bg-gray-200", "dark:bg-gray-700")
    })

    it("should render with default dimensions", () => {
      const { container } = render(<ImagePlaceholder />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle("width: 100%")
      expect(placeholder).toHaveStyle("height: 100%")
    })

    it("should render with custom dimensions", () => {
      const { container } = render(<ImagePlaceholder width={200} height={150} />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle("width: 200px")
      expect(placeholder).toHaveStyle("height: 150px")
    })

    it("should render with string dimensions", () => {
      const { container } = render(<ImagePlaceholder width="50%" height="200px" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle("width: 50%")
      expect(placeholder).toHaveStyle("height: 200px")
    })

    it("should apply custom className", () => {
      const { container } = render(<ImagePlaceholder className="custom-class" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("custom-class")
    })
  })

  describe("Skeleton variant", () => {
    it("should render skeleton variant by default", () => {
      const { container } = render(<ImagePlaceholder />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("bg-gray-200", "dark:bg-gray-700")
    })

    it("should render skeleton variant explicitly", () => {
      const { container } = render(<ImagePlaceholder variant="skeleton" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("bg-gray-200", "dark:bg-gray-700")
    })

    it("should have animation by default", () => {
      const { container } = render(<ImagePlaceholder />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("animate-pulse")
    })

    it("should not have animation when animate is false", () => {
      const { container } = render(<ImagePlaceholder animate={false} />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).not.toHaveClass("animate-pulse")
    })
  })

  describe("Icon variant", () => {
    it("should render icon variant with custom icon", () => {
      const customIcon = <span data-testid="custom-icon">📷</span>
      const { container } = render(<ImagePlaceholder variant="icon" icon={customIcon} />)

      expect(screen.getByTestId("custom-icon")).toBeInTheDocument()
      expect(screen.getByTestId("custom-icon")).toHaveTextContent("📷")
    })

    it("should render icon with proper styling", () => {
      const customIcon = <span data-testid="custom-icon">📷</span>
      const { container } = render(<ImagePlaceholder variant="icon" icon={customIcon} />)

      const iconContainer = screen.getByTestId("custom-icon").parentElement
      expect(iconContainer).toHaveClass(
        "text-gray-400",
        "dark:text-gray-500",
        "text-4xl"
      )
    })

    it("should not render icon when variant is icon but no icon provided", () => {
      const { container } = render(<ImagePlaceholder variant="icon" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toBeInTheDocument()
      expect(placeholder).toHaveClass("bg-gray-200", "dark:bg-gray-700")
      // Should fall back to skeleton behavior
    })

    it("should have animation by default in icon variant", () => {
      const customIcon = <span data-testid="custom-icon">📷</span>
      const { container } = render(<ImagePlaceholder variant="icon" icon={customIcon} />)

      // The animate-pulse class is on the outer container, not the icon wrapper
      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("animate-pulse")
    })

    it("should not have animation when animate is false in icon variant", () => {
      const customIcon = <span data-testid="custom-icon">📷</span>
      const { container } = render(<ImagePlaceholder variant="icon" icon={customIcon} animate={false} />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).not.toHaveClass("animate-pulse")
    })
  })

  describe("Gradient variant", () => {
    it("should render gradient variant", () => {
      const { container } = render(<ImagePlaceholder variant="gradient" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass(
        "bg-gradient-to-br",
        "from-gray-200",
        "to-gray-300",
        "dark:from-gray-700",
        "dark:to-gray-600"
      )
    })

    it("should have animation by default in gradient variant", () => {
      const { container } = render(<ImagePlaceholder variant="gradient" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("animate-pulse")
    })

    it("should not have animation when animate is false in gradient variant", () => {
      const { container } = render(<ImagePlaceholder variant="gradient" animate={false} />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).not.toHaveClass("animate-pulse")
    })
  })

  describe("Base styling", () => {
    it("should have base flex classes", () => {
      const { container } = render(<ImagePlaceholder />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("flex", "items-center", "justify-center")
    })

    it("should have base background classes", () => {
      const { container } = render(<ImagePlaceholder />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("bg-gray-200", "dark:bg-gray-700")
    })
  })

  describe("Animation control", () => {
    it("should have animation by default", () => {
      const { container } = render(<ImagePlaceholder />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("animate-pulse")
    })

    it("should not have animation when animate is false", () => {
      const { container } = render(<ImagePlaceholder animate={false} />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).not.toHaveClass("animate-pulse")
    })

    it("should have animation when animate is true", () => {
      const { container } = render(<ImagePlaceholder animate={true} />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveClass("animate-pulse")
    })
  })

  describe("Combined props", () => {
    it("should handle all props together", () => {
      const customIcon = <span data-testid="custom-icon">📷</span>
      const { container } = render(<ImagePlaceholder
          width={300}
          height={200}
          variant="icon"
          icon={customIcon}
          className="custom-class"
          animate={false}
        />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle("width: 300px")
      expect(placeholder).toHaveStyle("height: 200px")
      expect(placeholder).toHaveClass("custom-class")
      expect(placeholder).not.toHaveClass("animate-pulse")
      expect(screen.getByTestId("custom-icon")).toBeInTheDocument()
    })

    it("should handle gradient variant with custom dimensions and className", () => {
      const { container } = render(<ImagePlaceholder
          width="50%"
          height="100px"
          variant="gradient"
          className="custom-gradient"
          animate={true}
        />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle("width: 50%")
      expect(placeholder).toHaveStyle("height: 100px")
      expect(placeholder).toHaveClass("custom-gradient")
      expect(placeholder).toHaveClass("animate-pulse")
      expect(placeholder).toHaveClass("bg-gradient-to-br")
    })
  })

  describe("Edge cases", () => {
    it("should handle zero dimensions", () => {
      const { container } = render(<ImagePlaceholder width={0} height={0} />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle("width: 0px")
      expect(placeholder).toHaveStyle("height: 0px")
    })

    it("should handle negative dimensions", () => {
      const { container } = render(<ImagePlaceholder width={-100} height={-50} />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle("width: -100px")
      expect(placeholder).toHaveStyle("height: -50px")
    })

    it("should handle empty string className", () => {
      const { container } = render(<ImagePlaceholder className="" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toBeInTheDocument()
    })

    it("should handle complex icon elements", () => {
      const complexIcon = (
        <div data-testid="complex-icon">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
      )

      const { container } = render(<ImagePlaceholder variant="icon" icon={complexIcon} />)

      expect(screen.getByTestId("complex-icon")).toBeInTheDocument()
      expect(screen.getByTestId("complex-icon").querySelector("svg")).toBeInTheDocument()
    })
  })
})
