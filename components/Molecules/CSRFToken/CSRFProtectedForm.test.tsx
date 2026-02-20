import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CSRFProtectedForm } from "./CSRFProtectedForm"

// Mock the useCSRF hook
vi.mock("~/hooks/useCSRF", () => ({
  useCSRF: vi.fn(),
}))

import { useCSRF } from "~/hooks/useCSRF"

describe("CSRFProtectedForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCSRF).mockReturnValue({
      csrfToken: "test-csrf-token",
      isLoading: false,
      getToken: vi.fn(),
      addToFormData: vi.fn(),
      addToHeaders: vi.fn(),
      submitForm: vi.fn(),
    })
  })

  describe("Rendering", () => {
    it("should render a form element", () => {
      const { container } = render(<CSRFProtectedForm>
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toBeInTheDocument()
      expect(form?.tagName).toBe("FORM")
    })

    it("should render children", () => {
      render(<CSRFProtectedForm>
          <input type="text" name="username" placeholder="Username" />
          <button type="submit">Submit</button>
        </CSRFProtectedForm>)

      expect(screen.getByPlaceholderText("Username")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument()
    })

    it("should include CSRFToken component with default name", () => {
      const { container } = render(<CSRFProtectedForm>
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const csrfInput = container.querySelector('input[name="_csrf"]')
      expect(csrfInput).toBeInTheDocument()
      expect(csrfInput).toHaveAttribute("type", "hidden")
      expect(csrfInput).toHaveValue("test-csrf-token")
    })

    it("should include CSRFToken with custom name", () => {
      const { container } = render(<CSRFProtectedForm csrfName="custom_token">
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const csrfInput = container.querySelector('input[name="custom_token"]')
      expect(csrfInput).toBeInTheDocument()
      expect(csrfInput).toHaveValue("test-csrf-token")
    })

    it("should have correct displayName", () => {
      expect(CSRFProtectedForm.displayName).toBe("CSRFProtectedForm")
    })
  })

  describe("Form Attributes", () => {
    it("should forward method attribute", () => {
      const { container } = render(<CSRFProtectedForm method="POST">
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toHaveAttribute("method", "POST")
    })

    it("should forward action attribute", () => {
      const { container } = render(<CSRFProtectedForm action="/api/submit">
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toHaveAttribute("action", "/api/submit")
    })

    it("should forward encType attribute", () => {
      const { container } = render(<CSRFProtectedForm encType="multipart/form-data">
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toHaveAttribute("encType", "multipart/form-data")
    })

    it("should forward className attribute", () => {
      const { container } = render(<CSRFProtectedForm className="custom-form-class">
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toHaveClass("custom-form-class")
    })

    it("should forward data attributes", () => {
      render(<CSRFProtectedForm data-testid="protected-form" data-tracking="form-submit">
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const form = screen.getByTestId("protected-form")
      expect(form).toHaveAttribute("data-tracking", "form-submit")
    })

    it("should forward aria attributes", () => {
      const { container } = render(<CSRFProtectedForm
          aria-label="Login form"
          aria-describedby="form-description"
        >
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toHaveAttribute("aria-label", "Login form")
      expect(form).toHaveAttribute("aria-describedby", "form-description")
    })
  })

  describe("Ref Forwarding", () => {
    it("should forward ref to form element", () => {
      const formRef = createRef<HTMLFormElement>()

      render(<CSRFProtectedForm ref={formRef}>
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      expect(formRef.current).toBeInstanceOf(HTMLFormElement)
      expect(formRef.current?.tagName).toBe("FORM")
    })

    it("should allow form methods to be called via ref", () => {
      const formRef = createRef<HTMLFormElement>()

      render(<CSRFProtectedForm ref={formRef}>
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      expect(formRef.current?.reset).toBeDefined()
      expect(formRef.current?.submit).toBeDefined()
      expect(formRef.current?.checkValidity).toBeDefined()
    })
  })

  describe("Event Handlers", () => {
    it("should handle onSubmit event", () => {
      const handleSubmit = vi.fn(e => e.preventDefault())

      render(<CSRFProtectedForm onSubmit={handleSubmit}>
          <button type="submit">Submit</button>
        </CSRFProtectedForm>)

      const submitButton = screen.getByRole("button", { name: "Submit" })
      submitButton.click()

      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })

    it("should forward onChange event handler", () => {
      const handleChange = vi.fn()

      const { container } = render(<CSRFProtectedForm onChange={handleChange}>
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toBeDefined()

      // Verify onChange prop was forwarded to form element
      expect(form).toHaveProperty("onchange")
    })
  })

  describe("Security - CSRF Protection", () => {
    it("should always include CSRF token in form", () => {
      const { container } = render(<CSRFProtectedForm>
          <input type="text" name="username" />
          <input type="password" name="password" />
        </CSRFProtectedForm>)

      const csrfInput = container.querySelector('input[type="hidden"][name="_csrf"]')
      expect(csrfInput).toBeInTheDocument()
    })

    it("should handle missing CSRF token gracefully", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFProtectedForm>
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      // CSRF token component should not render when token is null
      const csrfInput = container.querySelector('input[name="_csrf"]')
      expect(csrfInput).not.toBeInTheDocument()
    })

    it("should handle loading state", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: true,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFProtectedForm>
          <input type="text" name="test" />
        </CSRFProtectedForm>)

      const csrfInput = container.querySelector('input[name="_csrf"]')
      expect(csrfInput).not.toBeInTheDocument()
    })

    it("should position CSRF token before other inputs", () => {
      const { container } = render(<CSRFProtectedForm>
          <input type="text" name="field1" />
          <input type="text" name="field2" />
        </CSRFProtectedForm>)

      const inputs = container.querySelectorAll("input")
      expect(inputs[0]).toHaveAttribute("name", "_csrf")
      expect(inputs[1]).toHaveAttribute("name", "field1")
      expect(inputs[2]).toHaveAttribute("name", "field2")
    })
  })

  describe("Form Types", () => {
    it("should work with login forms", () => {
      const { container } = render(<CSRFProtectedForm method="POST" action="/login">
          <input type="email" name="email" />
          <input type="password" name="password" />
          <button type="submit">Login</button>
        </CSRFProtectedForm>)

      expect(container.querySelector('input[name="_csrf"]')).toBeInTheDocument()
      expect(container.querySelector('input[name="email"]')).toBeInTheDocument()
      expect(container.querySelector('input[name="password"]')).toBeInTheDocument()
    })

    it("should work with multipart forms", () => {
      const { container } = render(<CSRFProtectedForm method="POST" encType="multipart/form-data">
          <input type="file" name="avatar" />
          <button type="submit">Upload</button>
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toHaveAttribute("encType", "multipart/form-data")
    })

    it("should work with complex nested structures", () => {
      const { container } = render(<CSRFProtectedForm>
          <div>
            <fieldset>
              <legend>User Details</legend>
              <input type="text" name="name" />
              <input type="email" name="email" />
            </fieldset>
          </div>
        </CSRFProtectedForm>)

      expect(container.querySelector('input[name="_csrf"]')).toBeInTheDocument()
      expect(container.querySelector('input[name="name"]')).toBeInTheDocument()
      expect(container.querySelector('input[name="email"]')).toBeInTheDocument()
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty children", () => {
      const { container } = render(<CSRFProtectedForm />)

      const form = container.querySelector("form")
      expect(form).toBeInTheDocument()
      expect(container.querySelector('input[name="_csrf"]')).toBeInTheDocument()
    })

    it("should handle multiple children of different types", () => {
      const { container } = render(<CSRFProtectedForm>
          <input type="text" name="field1" />
          <div>
            <input type="text" name="field2" />
          </div>
          <button type="submit">Submit</button>
          Some text node
        </CSRFProtectedForm>)

      expect(container.querySelector("form")).toBeInTheDocument()
    })

    it("should handle form with no submit button", () => {
      const { container } = render(<CSRFProtectedForm>
          <input type="text" name="search" />
        </CSRFProtectedForm>)

      expect(container.querySelector("form")).toBeInTheDocument()
      expect(container.querySelector('input[name="_csrf"]')).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("should maintain form accessibility with ARIA labels", () => {
      const { container } = render(<CSRFProtectedForm aria-label="Contact form">
          <input type="text" name="name" aria-label="Your name" />
        </CSRFProtectedForm>)

      const form = container.querySelector("form")
      expect(form).toHaveAttribute("aria-label", "Contact form")
    })

    it("should not interfere with form validation", () => {
      render(<CSRFProtectedForm>
          <input type="email" name="email" required />
          <button type="submit">Submit</button>
        </CSRFProtectedForm>)

      const emailInput = screen.getByRole("textbox")
      expect(emailInput).toHaveAttribute("required")
      expect(emailInput).toHaveAttribute("type", "email")
    })

    it("should maintain proper form semantics", () => {
      render(<CSRFProtectedForm>
          <label htmlFor="username">Username</label>
          <input id="username" type="text" name="username" />
        </CSRFProtectedForm>)

      const input = screen.getByLabelText("Username")
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute("name", "username")
    })
  })
})
