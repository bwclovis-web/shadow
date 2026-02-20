import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { useFieldValidation } from "~/hooks/useValidation"

import ValidatedInput from "./ValidatedInput"

// Mock useFieldValidation hook
vi.mock("~/hooks/useValidation", () => ({
  useFieldValidation: vi.fn(),
}))

const mockUseFieldValidation = vi.mocked(useFieldValidation)

// Mock FormField component
vi.mock("../FormField/FormField", () => ({
  default: ({
    children,
    label,
    error,
    success,
    required,
    disabled,
    className,
    labelClassName,
    fieldClassName,
    helpText,
    showValidationIcon,
  }: any) => (
    <div className={className}>
      {label && <label className={labelClassName}>{label}</label>}
      <div className={fieldClassName}>
        {children}
        {error && <div data-testid="error-message">{error}</div>}
        {success && <div data-testid="success-message">{success}</div>}
        {helpText && <div data-testid="help-text">{helpText}</div>}
        {showValidationIcon && (error || success) && (
          <div data-testid="validation-icon">icon</div>
        )}
      </div>
    </div>
  ),
}))

describe("ValidatedInput", () => {
  const defaultProps = {
    name: "testField",
    value: "",
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFieldValidation.mockReturnValue({
      error: "",
      isValidating: false,
    })
  })

  describe("Rendering", () => {
    it("should render input with basic props", () => {
      render(<ValidatedInput {...defaultProps} />)

      const input = screen.getByRole("textbox")
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute("name", "testField")
      expect(input).toHaveAttribute("type", "text")
    })

    it("should render with label", () => {
      render(<ValidatedInput {...defaultProps} label="Test Label" />)

      expect(screen.getByText("Test Label")).toBeInTheDocument()
    })

    it("should render with placeholder", () => {
      render(<ValidatedInput {...defaultProps} placeholder="Enter text" />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("placeholder", "Enter text")
    })

    it("should render with help text", () => {
      render(<ValidatedInput {...defaultProps} helpText="This is help text" />)

      expect(screen.getByTestId("help-text")).toHaveTextContent("This is help text")
    })

    it("should render with different input types", () => {
      const { rerender, container } = render(<ValidatedInput {...defaultProps} type="email" />)
      expect(screen.getByRole("textbox")).toHaveAttribute("type", "email")

      rerender(<ValidatedInput {...defaultProps} type="password" />)
      // Password inputs don't have "textbox" role, query by name attribute instead
      const passwordInput = container.querySelector('input[name="testField"][type="password"]')
      expect(passwordInput).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute("type", "password")

      rerender(<ValidatedInput {...defaultProps} type="number" />)
      expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number")
    })
  })

  describe("Form integration", () => {
    it("should call onChange when input value changes", () => {
      const onChange = vi.fn()
      render(<ValidatedInput {...defaultProps} onChange={onChange} />)

      const input = screen.getByRole("textbox")
      fireEvent.change(input, { target: { value: "new value" } })

      expect(onChange).toHaveBeenCalledWith("new value")
    })

    it("should call onBlur when input loses focus", () => {
      const onBlur = vi.fn()
      render(<ValidatedInput {...defaultProps} onBlur={onBlur} />)

      const input = screen.getByRole("textbox")
      fireEvent.blur(input)

      expect(onBlur).toHaveBeenCalledTimes(1)
    })

    it("should not call onBlur when onBlur is not provided", () => {
      render(<ValidatedInput {...defaultProps} />)

      const input = screen.getByRole("textbox")

      // Should not throw error
      expect(() => fireEvent.blur(input)).not.toThrow()
    })
  })

  describe("Validation", () => {
    it("should use field validation hook", () => {
      const schema = z.string().min(3)
      render(<ValidatedInput
          {...defaultProps}
          validationSchema={schema}
          validateOnChange={true}
          debounceMs={500}
        />)

      expect(mockUseFieldValidation).toHaveBeenCalledWith(schema, "testField", "", {
        validateOnChange: true,
        debounceMs: 500,
      })
    })

    it("should show error when validation fails", () => {
      mockUseFieldValidation.mockReturnValue({
        error: "Field is required",
        isValidating: false,
      })

      render(<ValidatedInput {...defaultProps} />)

      // Simulate field being touched by blurring
      const input = screen.getByRole("textbox")
      fireEvent.blur(input)

      expect(screen.getByTestId("error-message")).toHaveTextContent("Field is required")
    })

    it("should show success when validation passes", () => {
      mockUseFieldValidation.mockReturnValue({
        error: "",
        isValidating: false,
      })

      render(<ValidatedInput {...defaultProps} value="valid value" />)

      // Simulate field being touched by blurring
      const input = screen.getByRole("textbox")
      fireEvent.blur(input)

      expect(screen.getByTestId("success-message")).toHaveTextContent("Valid")
    })

    it("should not show success when field is not touched", () => {
      mockUseFieldValidation.mockReturnValue({
        error: "",
        isValidating: false,
      })

      render(<ValidatedInput {...defaultProps} value="valid value" />)

      expect(screen.queryByTestId("success-message")).not.toBeInTheDocument()
    })

    it("should not show success when value is empty", () => {
      mockUseFieldValidation.mockReturnValue({
        error: "",
        isValidating: false,
      })

      render(<ValidatedInput {...defaultProps} value="" />)

      // Simulate field being touched by blurring
      const input = screen.getByRole("textbox")
      fireEvent.blur(input)

      expect(screen.queryByTestId("success-message")).not.toBeInTheDocument()
    })

    it("should show validation icon when validation state exists", () => {
      mockUseFieldValidation.mockReturnValue({
        error: "Field is required",
        isValidating: false,
      })

      render(<ValidatedInput {...defaultProps} />)

      // Simulate field being touched by blurring
      const input = screen.getByRole("textbox")
      fireEvent.blur(input)

      expect(screen.getByTestId("validation-icon")).toBeInTheDocument()
    })

    it("should not show validation icon when showValidationIcon is false", () => {
      mockUseFieldValidation.mockReturnValue({
        error: "Field is required",
        isValidating: false,
      })

      render(<ValidatedInput {...defaultProps} showValidationIcon={false} />)

      // Simulate field being touched by blurring
      const input = screen.getByRole("textbox")
      fireEvent.blur(input)

      expect(screen.queryByTestId("validation-icon")).not.toBeInTheDocument()
    })
  })

  describe("Input attributes", () => {
    it("should set required attribute", () => {
      render(<ValidatedInput {...defaultProps} required />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("required")
    })

    it("should set disabled attribute", () => {
      render(<ValidatedInput {...defaultProps} disabled />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("disabled")
    })

    it("should set autoComplete attribute", () => {
      render(<ValidatedInput {...defaultProps} autoComplete="email" />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("autoComplete", "email")
    })

    it("should set maxLength attribute", () => {
      render(<ValidatedInput {...defaultProps} maxLength={100} />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("maxLength", "100")
    })

    it("should set minLength attribute", () => {
      render(<ValidatedInput {...defaultProps} minLength={3} />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("minLength", "3")
    })

    it("should set pattern attribute", () => {
      render(<ValidatedInput {...defaultProps} pattern="[0-9]+" />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("pattern", "[0-9]+")
    })

    it("should set step attribute for number input", () => {
      render(<ValidatedInput {...defaultProps} type="number" step={0.1} />)

      const input = screen.getByRole("spinbutton")
      expect(input).toHaveAttribute("step", "0.1")
    })

    it("should set min and max attributes for number input", () => {
      render(<ValidatedInput {...defaultProps} type="number" min={0} max={100} />)

      const input = screen.getByRole("spinbutton")
      expect(input).toHaveAttribute("min", "0")
      expect(input).toHaveAttribute("max", "100")
    })
  })

  describe("Styling", () => {
    it("should apply base input classes", () => {
      render(<ValidatedInput {...defaultProps} />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass(
        "block",
        "w-full",
        "px-3",
        "py-2",
        "border",
        "rounded-md",
        "shadow-sm",
        "focus:outline-none",
        "focus:ring-1",
        "focus:ring-opacity-50",
        "disabled:bg-gray-50",
        "disabled:cursor-not-allowed"
      )
    })

    it("should apply animation when validating", () => {
      mockUseFieldValidation.mockReturnValue({
        error: "",
        isValidating: true,
      })

      render(<ValidatedInput {...defaultProps} />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveClass("animate-pulse")
    })

    it("should not apply animation when not validating", () => {
      mockUseFieldValidation.mockReturnValue({
        error: "",
        isValidating: false,
      })

      render(<ValidatedInput {...defaultProps} />)

      const input = screen.getByRole("textbox")
      expect(input).not.toHaveClass("animate-pulse")
    })

    it("should pass custom className to FormField", () => {
      const { container } = render(<ValidatedInput {...defaultProps} className="custom-class" />)

      // FormField applies className to the outer div
      const outerDiv = container.querySelector("div.custom-class")
      expect(outerDiv).toBeInTheDocument()
    })

    it("should pass custom labelClassName to FormField", () => {
      render(<ValidatedInput
          {...defaultProps}
          label="Test Label"
          labelClassName="custom-label"
        />)

      const label = screen.getByText("Test Label")
      expect(label).toHaveClass("custom-label")
    })

    it("should pass custom fieldClassName to FormField", () => {
      render(<ValidatedInput {...defaultProps} fieldClassName="custom-field" />)

      const fieldContainer = screen.getByRole("textbox").parentElement
      expect(fieldContainer).toHaveClass("custom-field")
    })
  })

  describe("Ref forwarding", () => {
    it("should forward ref to input element", () => {
      const ref = createRef<HTMLInputElement>()

      render(<ValidatedInput {...defaultProps} ref={ref} />)

      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })
  })

  describe("Display name", () => {
    it("should have correct display name", () => {
      expect(ValidatedInput.displayName).toBe("ValidatedInput")
    })
  })

  describe("Default values", () => {
    it("should use default type", () => {
      render(<ValidatedInput {...defaultProps} />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("type", "text")
    })

    it("should use default validation options", () => {
      render(<ValidatedInput {...defaultProps} />)

      expect(mockUseFieldValidation).toHaveBeenCalledWith(
        expect.any(Object), // z.any() schema
        "testField",
        "",
        {
          validateOnChange: true,
          debounceMs: 300,
        }
      )
    })

    it("should use default boolean values", () => {
      render(<ValidatedInput {...defaultProps} />)

      const input = screen.getByRole("textbox")
      expect(input).not.toHaveAttribute("required")
      expect(input).not.toHaveAttribute("disabled")
    })
  })

  describe("Edge cases", () => {
    it("should handle empty string value", () => {
      render(<ValidatedInput {...defaultProps} value="" />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveAttribute("value", "")
    })

    it("should handle undefined validation schema", () => {
      render(<ValidatedInput {...defaultProps} validationSchema={undefined} />)

      expect(mockUseFieldValidation).toHaveBeenCalledWith(
        expect.any(Object), // z.any() schema
        "testField",
        "",
        expect.any(Object)
      )
    })

    it("should handle zero debounceMs", () => {
      render(<ValidatedInput {...defaultProps} debounceMs={0} />)

      expect(mockUseFieldValidation).toHaveBeenCalledWith(
        expect.any(Object),
        "testField",
        "",
        {
          validateOnChange: true,
          debounceMs: 0,
        }
      )
    })
  })
})
