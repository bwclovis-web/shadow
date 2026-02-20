import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CSRFToken } from "./CSRFToken"

// Mock the useCSRF hook
vi.mock("~/hooks/useCSRF", () => ({
  useCSRF: vi.fn(),
}))

import { useCSRF } from "~/hooks/useCSRF"

describe("CSRFToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("Rendering", () => {
    it("should render hidden input with CSRF token", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-csrf-token-123",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)
      const input = container.querySelector('input[type="hidden"]')

      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute("name", "_csrf")
      expect(input).toHaveAttribute("value", "test-csrf-token-123")
    })

    it("should use custom name when provided", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-csrf-token-123",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken name="custom_csrf" />)
      const input = container.querySelector('input[type="hidden"]')

      expect(input).toHaveAttribute("name", "custom_csrf")
    })

    it('should have input type="hidden"', () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-csrf-token-123",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)
      const input = container.querySelector("input")

      expect(input).toHaveAttribute("type", "hidden")
    })
  })

  describe("Loading State", () => {
    it("should return null when loading", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: true,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)
      const input = container.querySelector("input")

      expect(input).not.toBeInTheDocument()
    })

    it("should render after loading completes", () => {
      // Start with loading state
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: true,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { rerender, container } = render(<CSRFToken />)
      expect(container.querySelector("input")).not.toBeInTheDocument()

      // Simulate loading complete
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-csrf-token-123",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })
      rerender(<CSRFToken />)

      expect(container.querySelector("input")).toBeInTheDocument()
      expect(container.querySelector("input")).toHaveValue("test-csrf-token-123")
    })
  })

  describe("Security - Token Handling", () => {
    it("should return null when token is null", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)
      const input = container.querySelector("input")

      expect(input).not.toBeInTheDocument()
    })

    it("should return null when token is empty string", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)
      const input = container.querySelector("input")

      expect(input).not.toBeInTheDocument()
    })

    it("should handle very long tokens", () => {
      const longToken = "a".repeat(1000)
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: longToken,
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)
      const input = container.querySelector('input[type="hidden"]')

      expect(input).toHaveAttribute("value", longToken)
    })

    it("should handle tokens with special characters", () => {
      const specialToken = "abc-123_XYZ.456+789/==="
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: specialToken,
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)
      const input = container.querySelector('input[type="hidden"]')

      expect(input).toHaveAttribute("value", specialToken)
    })

    it("should not expose token in visible DOM", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "secret-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)

      // Should not be visible to screen readers or visible text
      expect(screen.queryByText("secret-token")).not.toBeInTheDocument()

      // Token should be in hidden input only, not visible in any other way
      const input = container.querySelector('input[type="hidden"]')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue("secret-token")

      // Verify it's truly hidden
      expect(input).toHaveAttribute("type", "hidden")
    })
  })

  describe("Integration with Forms", () => {
    it("should work within a form element", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<form data-testid="test-form">
          <CSRFToken />
          <input type="text" name="username" />
        </form>)

      const form = container.querySelector('[data-testid="test-form"]')
      const csrfInput = form?.querySelector('input[name="_csrf"]')
      const usernameInput = form?.querySelector('input[name="username"]')

      expect(form).toBeInTheDocument()
      expect(csrfInput).toBeInTheDocument()
      expect(usernameInput).toBeInTheDocument()
    })

    it("should not interfere with other form inputs", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<form>
          <input type="text" name="field1" value="value1" readOnly />
          <CSRFToken />
          <input type="text" name="field2" value="value2" readOnly />
        </form>)

      const field1 = container.querySelector('input[name="field1"]')
      const field2 = container.querySelector('input[name="field2"]')
      const csrf = container.querySelector('input[name="_csrf"]')

      expect(field1).toHaveValue("value1")
      expect(field2).toHaveValue("value2")
      expect(csrf).toHaveValue("test-token")
    })

    it("should allow multiple CSRF tokens with different names", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<form>
          <CSRFToken name="csrf1" />
          <CSRFToken name="csrf2" />
        </form>)

      const csrf1 = container.querySelector('input[name="csrf1"]')
      const csrf2 = container.querySelector('input[name="csrf2"]')

      expect(csrf1).toBeInTheDocument()
      expect(csrf2).toBeInTheDocument()
      expect(csrf1).toHaveValue("test-token")
      expect(csrf2).toHaveValue("test-token")
    })
  })

  describe("Edge Cases", () => {
    it("should handle token updates", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "old-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { rerender, container } = render(<CSRFToken />)
      expect(container.querySelector("input")).toHaveValue("old-token")

      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "new-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })
      rerender(<CSRFToken />)

      expect(container.querySelector("input")).toHaveValue("new-token")
    })

    it("should handle name prop updates", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { rerender, container } = render(<CSRFToken name="name1" />)
      expect(container.querySelector("input")).toHaveAttribute("name", "name1")

      rerender(<CSRFToken name="name2" />)
      expect(container.querySelector("input")).toHaveAttribute("name", "name2")
    })

    it("should handle rapid loading state changes", () => {
      // Start with loading
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: true,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { rerender, container } = render(<CSRFToken />)
      expect(container.querySelector("input")).not.toBeInTheDocument()

      // Loaded
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })
      rerender(<CSRFToken />)
      expect(container.querySelector("input")).toBeInTheDocument()

      // Loading again
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: true,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })
      rerender(<CSRFToken />)
      expect(container.querySelector("input")).not.toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("should be hidden from user interaction", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      const { container } = render(<CSRFToken />)
      const input = container.querySelector("input") as HTMLInputElement

      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute("type", "hidden")

      // Verify it has the hidden type attribute which makes it non-interactive
      expect(input.type).toBe("hidden")

      // Hidden inputs should not be part of normal user interaction
      // They won't show up in queries like getByRole
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    })

    it("should not affect form accessibility", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-token",
        isLoading: false,
        getToken: vi.fn(),
        addToFormData: vi.fn(),
        addToHeaders: vi.fn(),
        submitForm: vi.fn(),
      })

      render(<form aria-label="Test form">
          <CSRFToken />
          <label htmlFor="username">Username</label>
          <input id="username" type="text" name="username" />
        </form>)

      expect(screen.getByLabelText("Username")).toBeInTheDocument()
      expect(screen.getByRole("textbox")).toBeInTheDocument()
    })
  })
})
