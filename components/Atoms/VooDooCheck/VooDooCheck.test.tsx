import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { testAxeAccessibility } from "~/../test/utils/accessibility-test-utils"

import VooDooCheck from "./VooDooCheck"

describe("VooDooCheck", () => {
  const defaultProps = {
    checked: false,
    onChange: vi.fn(),
    labelChecked: "On",
    labelUnchecked: "Off",
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Rendering", () => {
    it("should render with unchecked state", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      const label = screen.getByText("Off")

      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
      expect(label).toBeInTheDocument()
    })

    it("should render with checked state", () => {
      render(<VooDooCheck {...defaultProps} checked />)

      const checkbox = screen.getByRole("checkbox")
      const label = screen.getByText("On")

      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toBeChecked()
      expect(label).toBeInTheDocument()
    })

    it("should render with custom id", () => {
      render(<VooDooCheck {...defaultProps} id="custom-id" />)

      const checkbox = screen.getByRole("checkbox")
      expect(checkbox).toHaveAttribute("id", "custom-id")
    })

    it("should render without id when not provided", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      expect(checkbox).not.toHaveAttribute("id")
    })
  })

  describe("Styling", () => {
    it("should apply unchecked styling", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      const toggleContainer = checkbox.parentElement?.querySelector(".box")
      const toggleButton = checkbox.parentElement?.querySelector(".absolute")

      expect(toggleContainer).toHaveClass("bg-noir-black")
      expect(toggleButton).toHaveClass(
        "bg-noir-gray",
        "translate-x-0",
        "border-noir-black"
      )
    })

    it("should apply checked styling", () => {
      render(<VooDooCheck {...defaultProps} checked />)

      const checkbox = screen.getByRole("checkbox")
      const toggleContainer = checkbox.parentElement?.querySelector(".box")
      const toggleButton = checkbox.parentElement?.querySelector(".absolute")

      expect(toggleContainer).toHaveClass("bg-noir-gold-100")
      expect(toggleButton).toHaveClass(
        "bg-noir-gold-500",
        "translate-x-6",
        "border-noir-gold-100"
      )
    })

    it("should have proper label styling", () => {
      render(<VooDooCheck {...defaultProps} />)

      const label = screen.getByText("Off")
      expect(label).toHaveClass(
        "text-sm",
        "font-medium",
        "text-noir-gold-100",
        "ml-2"
      )
    })

    it("should have proper container styling", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      const label = checkbox.closest("label")

      expect(label).toHaveClass(
        "flex",
        "cursor-pointer",
        "select-none",
        "items-center"
      )
    })

    it("should have proper toggle container styling", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      const toggleContainer = checkbox.parentElement

      expect(toggleContainer).toHaveClass(
        "relative",
        "rounded-full",
        "border-noir-gold-100",
        "border-2"
      )
    })

    it("should have proper toggle button styling", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      const toggleButton = checkbox.parentElement?.querySelector(".absolute")

      expect(toggleButton).toHaveClass(
        "absolute",
        "left-1",
        "top-1",
        "flex",
        "h-6",
        "w-6",
        "items-center",
        "justify-center",
        "rounded-full",
        "transition-transform",
        "duration-300",
        "ease-in-out"
      )
    })
  })

  describe("Interactions", () => {
    it("should call onChange when clicked", () => {
      const onChange = vi.fn()
      render(<VooDooCheck {...defaultProps} onChange={onChange} />)

      const checkbox = screen.getByRole("checkbox")
      fireEvent.click(checkbox)

      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it("should call onChange when label is clicked", () => {
      const onChange = vi.fn()
      render(<VooDooCheck {...defaultProps} onChange={onChange} />)

      const label = screen.getByText("Off")
      fireEvent.click(label)

      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it("should call onChange when toggle container is clicked", () => {
      const onChange = vi.fn()
      render(<VooDooCheck {...defaultProps} onChange={onChange} />)

      const checkbox = screen.getByRole("checkbox")
      const toggleContainer = checkbox.parentElement

      fireEvent.click(toggleContainer!)

      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  describe("Accessibility", () => {
    it("should have proper checkbox attributes", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      expect(checkbox).toHaveAttribute("type", "checkbox")
      expect(checkbox).toHaveClass("sr-only")
    })

    it("should be properly labeled", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      const label = screen.getByText("Off")

      expect(label.closest("label")).toContainElement(checkbox)
    })

    it("should have proper cursor styling", () => {
      render(<VooDooCheck {...defaultProps} />)

      const checkbox = screen.getByRole("checkbox")
      const label = checkbox.closest("label")

      expect(label).toHaveClass("cursor-pointer")
    })
  })

  describe("Label text", () => {
    it("should show checked label when checked", () => {
      render(<VooDooCheck {...defaultProps} checked />)

      expect(screen.getByText("On")).toBeInTheDocument()
      expect(screen.queryByText("Off")).not.toBeInTheDocument()
    })

    it("should show unchecked label when unchecked", () => {
      render(<VooDooCheck {...defaultProps} />)

      expect(screen.getByText("Off")).toBeInTheDocument()
      expect(screen.queryByText("On")).not.toBeInTheDocument()
    })

    it("should handle custom label text", () => {
      render(<VooDooCheck
          {...defaultProps}
          labelChecked="Enabled"
          labelUnchecked="Disabled"
        />)

      expect(screen.getByText("Disabled")).toBeInTheDocument()
      expect(screen.queryByText("Enabled")).not.toBeInTheDocument()
    })

    it("should update label text when state changes", () => {
      const { rerender } = render(<VooDooCheck {...defaultProps} />)

      expect(screen.getByText("Off")).toBeInTheDocument()

      rerender(<VooDooCheck {...defaultProps} checked />)

      expect(screen.getByText("On")).toBeInTheDocument()
      expect(screen.queryByText("Off")).not.toBeInTheDocument()
    })
  })

  describe("State management", () => {
    it("should reflect checked state correctly", () => {
      const { rerender } = render(<VooDooCheck {...defaultProps} />)

      let checkbox = screen.getByRole("checkbox")
      expect(checkbox).not.toBeChecked()

      rerender(<VooDooCheck {...defaultProps} checked />)

      checkbox = screen.getByRole("checkbox")
      expect(checkbox).toBeChecked()
    })

    it("should maintain state consistency", () => {
      render(<VooDooCheck {...defaultProps} checked />)

      const checkbox = screen.getByRole("checkbox")
      const toggleContainer = checkbox.parentElement?.querySelector(".box")
      const toggleButton = checkbox.parentElement?.querySelector(".absolute")
      const label = screen.getByText("On")

      expect(checkbox).toBeChecked()
      expect(toggleContainer).toHaveClass("bg-noir-gold-100")
      expect(toggleButton).toHaveClass("translate-x-6")
      expect(label).toBeInTheDocument()
    })
  })

  describe("Edge cases", () => {
    it("should handle empty label text", () => {
      render(<VooDooCheck {...defaultProps} labelChecked="" labelUnchecked="" />)

      const checkbox = screen.getByRole("checkbox")
      expect(checkbox).toBeInTheDocument()
    })

    it("should handle very long label text", () => {
      const longLabel = "This is a very long label text that might wrap or overflow"
      render(<VooDooCheck
          {...defaultProps}
          labelChecked={longLabel}
          labelUnchecked={longLabel}
        />)

      expect(screen.getByText(longLabel)).toBeInTheDocument()
    })

    it("should handle special characters in label text", () => {
      const specialLabel = "On/Off & More!"
      render(<VooDooCheck
          {...defaultProps}
          labelChecked={specialLabel}
          labelUnchecked={specialLabel}
        />)

      expect(screen.getByText(specialLabel)).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      await testAxeAccessibility(VooDooCheck, defaultProps, {
        tags: [
"wcag2a", "wcag2aa", "wcag21a", "wcag21aa"
],
      })
    })

    it("should have no accessibility violations when checked", async () => {
      await testAxeAccessibility(VooDooCheck, { ...defaultProps, checked: true }, {
        tags: [
"wcag2a", "wcag2aa", "wcag21a", "wcag21aa"
],
      })
    })
  })
})
