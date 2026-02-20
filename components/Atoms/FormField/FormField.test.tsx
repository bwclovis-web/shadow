import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"

import FormField from "./FormField"

// Mock ValidationMessage component
vi.mock("../ValidationMessage/ValidationMessage", () => ({
  default: ({ error, success, warning, info }: any) => {
    const message = error || success || warning || info
    return message ? <div data-testid="validation-message">{message}</div> : null
  },
}))

describe("FormField", () => {
  describe("Rendering", () => {
    it("should render with label and input", () => {
      render(<FormField label="Test Label">
          <input type="text" />
        </FormField>)

      expect(screen.getByText("Test Label")).toBeInTheDocument()
      expect(screen.getByRole("textbox")).toBeInTheDocument()
    })

    it("should render without label", () => {
      render(<FormField>
          <input type="text" />
        </FormField>)

      expect(screen.queryByText("Test Label")).not.toBeInTheDocument()
      expect(screen.getByRole("textbox")).toBeInTheDocument()
    })

    it("should render with help text", () => {
      render(<FormField label="Test Label" helpText="This is help text">
          <input type="text" />
        </FormField>)

      expect(screen.getByText("This is help text")).toBeInTheDocument()
      expect(screen.getByText("This is help text")).toHaveAttribute(
        "id",
        "help-text"
      )
    })
  })

  describe("Required field", () => {
    it("should show required indicator when required is true", () => {
      render(<FormField label="Test Label" required>
          <input type="text" />
        </FormField>)

      const label = screen.getByText("Test Label")
      expect(label).toHaveClass(
        'after:content-["*"]',
        "after:ml-1",
        "after:text-red-500"
      )
    })

    it("should not show required indicator when required is false", () => {
      render(<FormField label="Test Label" required={false}>
          <input type="text" />
        </FormField>)

      const label = screen.getByText("Test Label")
      expect(label).not.toHaveClass('after:content-["*"]')
    })
  })

  describe("Validation states", () => {
    it("should apply error styling and attributes", () => {
      render(<FormField label="Test Label" error="This is an error">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass(
        "border-red-300",
        "focus:border-red-500",
        "focus:ring-red-500"
      )
      expect(input).toHaveAttribute("aria-invalid", "true")
      expect(screen.getByTestId("validation-message")).toHaveTextContent("This is an error")
    })

    it("should apply success styling and attributes", () => {
      render(<FormField label="Test Label" success="This is a success">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass(
        "border-green-300",
        "focus:border-green-500",
        "focus:ring-green-500"
      )
      expect(screen.getByTestId("validation-message")).toHaveTextContent("This is a success")
    })

    it("should apply warning styling and attributes", () => {
      render(<FormField label="Test Label" warning="This is a warning">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass(
        "border-yellow-300",
        "focus:border-yellow-500",
        "focus:ring-yellow-500"
      )
      expect(screen.getByTestId("validation-message")).toHaveTextContent("This is a warning")
    })

    it("should apply info styling and attributes", () => {
      render(<FormField label="Test Label" info="This is info">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass(
        "border-blue-300",
        "focus:border-blue-500",
        "focus:ring-blue-500"
      )
      expect(screen.getByTestId("validation-message")).toHaveTextContent("This is info")
    })

    it("should apply default styling when no validation state", () => {
      render(<FormField label="Test Label">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass(
        "border-gray-300",
        "focus:border-blue-500",
        "focus:ring-blue-500"
      )
      expect(screen.queryByTestId("validation-message")).not.toBeInTheDocument()
    })
  })

  describe("Disabled state", () => {
    it("should apply disabled styling to input and label", () => {
      render(<FormField label="Test Label" disabled>
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      const label = screen.getByText("Test Label")

      expect(input).toHaveClass("bg-gray-50", "cursor-not-allowed")
      expect(input).toHaveAttribute("disabled")
      expect(label).toHaveClass("text-gray-400")
    })
  })

  describe("Validation icons", () => {
    it("should show error icon when showValidationIcon is true and has error", () => {
      render(<FormField label="Test Label" error="Error message" showValidationIcon>
          <input type="text" />
        </FormField>)

      const errorIcon = screen
        .getByRole("textbox")
        .parentElement?.querySelector("svg")
      expect(errorIcon).toBeInTheDocument()
      expect(errorIcon).toHaveClass("text-red-500")
    })

    it("should show success icon when showValidationIcon is true and has success", () => {
      render(<FormField label="Test Label" success="Success message" showValidationIcon>
          <input type="text" />
        </FormField>)

      const successIcon = screen
        .getByRole("textbox")
        .parentElement?.querySelector("svg")
      expect(successIcon).toBeInTheDocument()
      expect(successIcon).toHaveClass("text-green-500")
    })

    it("should show warning icon when showValidationIcon is true and has warning", () => {
      render(<FormField label="Test Label" warning="Warning message" showValidationIcon>
          <input type="text" />
        </FormField>)

      const warningIcon = screen
        .getByRole("textbox")
        .parentElement?.querySelector("svg")
      expect(warningIcon).toBeInTheDocument()
      expect(warningIcon).toHaveClass("text-yellow-500")
    })

    it("should show info icon when showValidationIcon is true and has info", () => {
      render(<FormField label="Test Label" info="Info message" showValidationIcon>
          <input type="text" />
        </FormField>)

      const infoIcon = screen
        .getByRole("textbox")
        .parentElement?.querySelector("svg")
      expect(infoIcon).toBeInTheDocument()
      expect(infoIcon).toHaveClass("text-blue-500")
    })

    it("should not show validation icon when showValidationIcon is false", () => {
      render(<FormField
          label="Test Label"
          error="Error message"
          showValidationIcon={false}
        >
          <input type="text" />
        </FormField>)

      const iconContainer = screen
        .getByRole("textbox")
        .parentElement?.querySelector(".absolute")
      expect(iconContainer).not.toBeInTheDocument()
    })

    it("should not show validation icon when no validation state", () => {
      render(<FormField label="Test Label" showValidationIcon>
          <input type="text" />
        </FormField>)

      const iconContainer = screen
        .getByRole("textbox")
        .parentElement?.querySelector(".absolute")
      expect(iconContainer).not.toBeInTheDocument()
    })
  })

  describe("Custom styling", () => {
    it("should apply custom className to container", () => {
      render(<FormField label="Test Label" className="custom-container">
          <input type="text" />
        </FormField>)

      const container = screen.getByText("Test Label").closest("div")
      expect(container).toHaveClass("custom-container")
    })

    it("should apply custom labelClassName to label", () => {
      render(<FormField label="Test Label" labelClassName="custom-label">
          <input type="text" />
        </FormField>)

      const label = screen.getByText("Test Label")
      expect(label).toHaveClass("custom-label")
    })

    it("should apply custom fieldClassName to field container", () => {
      render(<FormField label="Test Label" fieldClassName="custom-field">
          <input type="text" />
        </FormField>)

      const fieldContainer = screen.getByRole("textbox").parentElement
      expect(fieldContainer).toHaveClass("custom-field")
    })

    it("should merge existing input className with field state classes", () => {
      render(<FormField label="Test Label" error="Error message">
          <input type="text" className="existing-class" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass("existing-class", "border-red-300")
    })
  })

  describe("Accessibility", () => {
    it("should set aria-describedby with error message id", () => {
      render(<FormField label="Test Label" error="Error message">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("aria-describedby", "error-message")
    })

    it("should set aria-describedby with help text id", () => {
      render(<FormField label="Test Label" helpText="Help text">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("aria-describedby", "help-text")
    })

    it("should set aria-describedby with multiple ids", () => {
      render(<FormField label="Test Label" error="Error message" helpText="Help text">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("aria-describedby", "error-message help-text")
    })

    it("should not set aria-describedby when no descriptions", () => {
      render(<FormField label="Test Label">
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).not.toHaveAttribute("aria-describedby")
    })
  })

  describe("Ref forwarding", () => {
    it("should forward ref to container div", () => {
      const ref = createRef<HTMLDivElement>()

      render(<FormField ref={ref} label="Test Label">
          <input type="text" />
        </FormField>)

      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe("Display name", () => {
    it("should have correct display name", () => {
      expect(FormField.displayName).toBe("FormField")
    })
  })

  describe("Edge cases", () => {
    it("should handle non-input children", () => {
      render(<FormField label="Test Label">
          <select>
            <option value="1">Option 1</option>
          </select>
        </FormField>)

      expect(screen.getByRole("combobox")).toBeInTheDocument()
    })

    it("should handle multiple validation states (prioritize error)", () => {
      render(<FormField
          label="Test Label"
          error="Error message"
          success="Success message"
          warning="Warning message"
          info="Info message"
        >
          <input type="text" />
        </FormField>)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass("border-red-300")
      expect(screen.getByTestId("validation-message")).toHaveTextContent("Error message")
    })
  })
})
