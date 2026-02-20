import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CSRFTokenProvider, useCSRFToken } from "./CSRFTokenProvider"

// Mock the useCSRF hook
vi.mock("~/hooks/useCSRF", () => ({
  useCSRF: vi.fn(),
}))

import { useCSRF } from "~/hooks/useCSRF"

// Test component that uses the context
function TestConsumer() {
  const { csrfToken, isLoading, addToFormData, addToHeaders, submitForm } =
    useCSRFToken()

  return (
    <div>
      <div data-testid="csrf-token">{csrfToken || "null"}</div>
      <div data-testid="is-loading">{isLoading.toString()}</div>
      <button onClick={() => addToFormData(new FormData())}>Add to FormData</button>
      <button onClick={() => addToHeaders()}>Add to Headers</button>
      <button onClick={() => submitForm("/test", new FormData())}>
        Submit Form
      </button>
    </div>
  )
}

describe("CSRFTokenProvider", () => {
  const mockAddToFormData = vi.fn()
  const mockAddToHeaders = vi.fn()
  const mockSubmitForm = vi.fn()
  const mockGetToken = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCSRF).mockReturnValue({
      csrfToken: "test-token-123",
      isLoading: false,
      getToken: mockGetToken,
      addToFormData: mockAddToFormData,
      addToHeaders: mockAddToHeaders,
      submitForm: mockSubmitForm,
    })
  })

  describe("Context Provider", () => {
    it("should provide CSRF context to children", () => {
      render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("csrf-token")).toHaveTextContent("test-token-123")
      expect(screen.getByTestId("is-loading")).toHaveTextContent("false")
    })

    it("should render children", () => {
      render(<CSRFTokenProvider>
          <div data-testid="child">Child content</div>
        </CSRFTokenProvider>)

      expect(screen.getByTestId("child")).toHaveTextContent("Child content")
    })

    it("should call useCSRF hook", () => {
      render(<CSRFTokenProvider>
          <div>Content</div>
        </CSRFTokenProvider>)

      expect(useCSRF).toHaveBeenCalledTimes(1)
    })
  })

  describe("Context Values", () => {
    it("should provide csrfToken value", () => {
      render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("csrf-token")).toHaveTextContent("test-token-123")
    })

    it("should provide isLoading value", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: true,
        getToken: mockGetToken,
        addToFormData: mockAddToFormData,
        addToHeaders: mockAddToHeaders,
        submitForm: mockSubmitForm,
      })

      render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("is-loading")).toHaveTextContent("true")
    })

    it("should provide addToFormData function", () => {
      render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      const button = screen.getByRole("button", { name: "Add to FormData" })
      button.click()

      expect(mockAddToFormData).toHaveBeenCalledTimes(1)
      expect(mockAddToFormData).toHaveBeenCalledWith(expect.any(FormData))
    })

    it("should provide addToHeaders function", () => {
      render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      const button = screen.getByRole("button", { name: "Add to Headers" })
      button.click()

      expect(mockAddToHeaders).toHaveBeenCalledTimes(1)
    })

    it("should provide submitForm function", () => {
      render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      const button = screen.getByRole("button", { name: "Submit Form" })
      button.click()

      expect(mockSubmitForm).toHaveBeenCalledTimes(1)
      expect(mockSubmitForm).toHaveBeenCalledWith("/test", expect.any(FormData))
    })
  })

  describe("Multiple Children", () => {
    it("should provide context to multiple children", () => {
      render(<CSRFTokenProvider>
          <TestConsumer />
          <TestConsumer />
        </CSRFTokenProvider>)

      const tokens = screen.getAllByTestId("csrf-token")
      expect(tokens).toHaveLength(2)
      expect(tokens[0]).toHaveTextContent("test-token-123")
      expect(tokens[1]).toHaveTextContent("test-token-123")
    })

    it("should provide context to nested children", () => {
      render(<CSRFTokenProvider>
          <div>
            <div>
              <TestConsumer />
            </div>
          </div>
        </CSRFTokenProvider>)

      expect(screen.getByTestId("csrf-token")).toHaveTextContent("test-token-123")
    })
  })

  describe("Loading State", () => {
    it("should handle loading state", () => {
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: true,
        getToken: mockGetToken,
        addToFormData: mockAddToFormData,
        addToHeaders: mockAddToHeaders,
        submitForm: mockSubmitForm,
      })

      render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("is-loading")).toHaveTextContent("true")
      expect(screen.getByTestId("csrf-token")).toHaveTextContent("null")
    })

    it("should update when loading completes", () => {
      const { rerender } = render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      // Update mock to simulate loading complete
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "new-token",
        isLoading: false,
        getToken: mockGetToken,
        addToFormData: mockAddToFormData,
        addToHeaders: mockAddToHeaders,
        submitForm: mockSubmitForm,
      })

      rerender(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("is-loading")).toHaveTextContent("false")
      expect(screen.getByTestId("csrf-token")).toHaveTextContent("new-token")
    })
  })

  describe("Token Updates", () => {
    it("should handle token updates", () => {
      const { rerender } = render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("csrf-token")).toHaveTextContent("test-token-123")

      // Update token
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "updated-token-456",
        isLoading: false,
        getToken: mockGetToken,
        addToFormData: mockAddToFormData,
        addToHeaders: mockAddToHeaders,
        submitForm: mockSubmitForm,
      })

      rerender(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("csrf-token")).toHaveTextContent("updated-token-456")
    })

    it("should handle token becoming null", () => {
      const { rerender } = render(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("csrf-token")).toHaveTextContent("test-token-123")

      // Token becomes null
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: null,
        isLoading: false,
        getToken: mockGetToken,
        addToFormData: mockAddToFormData,
        addToHeaders: mockAddToHeaders,
        submitForm: mockSubmitForm,
      })

      rerender(<CSRFTokenProvider>
          <TestConsumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("csrf-token")).toHaveTextContent("null")
    })
  })
})

describe("useCSRFToken", () => {
  const mockAddToFormData = vi.fn()
  const mockAddToHeaders = vi.fn()
  const mockSubmitForm = vi.fn()
  const mockGetToken = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCSRF).mockReturnValue({
      csrfToken: "test-token",
      isLoading: false,
      getToken: mockGetToken,
      addToFormData: mockAddToFormData,
      addToHeaders: mockAddToHeaders,
      submitForm: mockSubmitForm,
    })
  })

  describe("Error Handling", () => {
    it("should throw error when used outside provider", () => {
      function InvalidConsumer() {
        useCSRFToken()
        return <div>Content</div>
      }

      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        render(<InvalidConsumer />)
      }).toThrow("useCSRFToken must be used within a CSRFTokenProvider")

      console.error = originalError
    })

    it("should not throw when used inside provider", () => {
      function ValidConsumer() {
        const context = useCSRFToken()
        return <div>{context.csrfToken}</div>
      }

      expect(() => {
        render(<CSRFTokenProvider>
            <ValidConsumer />
          </CSRFTokenProvider>)
      }).not.toThrow()
    })
  })

  describe("Context Access", () => {
    it("should provide access to csrfToken", () => {
      function Consumer() {
        const { csrfToken } = useCSRFToken()
        return <div data-testid="token">{csrfToken}</div>
      }

      render(<CSRFTokenProvider>
          <Consumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("token")).toHaveTextContent("test-token")
    })

    it("should provide access to isLoading", () => {
      function Consumer() {
        const { isLoading } = useCSRFToken()
        return <div data-testid="loading">{isLoading.toString()}</div>
      }

      render(<CSRFTokenProvider>
          <Consumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })

    it("should provide access to all utility functions", () => {
      function Consumer() {
        const context = useCSRFToken()
        return (
          <div>
            <div data-testid="has-add-form-data">
              {typeof context.addToFormData === "function" ? "yes" : "no"}
            </div>
            <div data-testid="has-add-headers">
              {typeof context.addToHeaders === "function" ? "yes" : "no"}
            </div>
            <div data-testid="has-submit-form">
              {typeof context.submitForm === "function" ? "yes" : "no"}
            </div>
          </div>
        )
      }

      render(<CSRFTokenProvider>
          <Consumer />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("has-add-form-data")).toHaveTextContent("yes")
      expect(screen.getByTestId("has-add-headers")).toHaveTextContent("yes")
      expect(screen.getByTestId("has-submit-form")).toHaveTextContent("yes")
    })
  })

  describe("Multiple Consumers", () => {
    it("should allow multiple components to access context", () => {
      function Consumer1() {
        const { csrfToken } = useCSRFToken()
        return <div data-testid="consumer1">{csrfToken}</div>
      }

      function Consumer2() {
        const { csrfToken } = useCSRFToken()
        return <div data-testid="consumer2">{csrfToken}</div>
      }

      render(<CSRFTokenProvider>
          <Consumer1 />
          <Consumer2 />
        </CSRFTokenProvider>)

      expect(screen.getByTestId("consumer1")).toHaveTextContent("test-token")
      expect(screen.getByTestId("consumer2")).toHaveTextContent("test-token")
    })

    it("should share same context between multiple consumers", () => {
      let addToFormDataRef1: any
      let addToFormDataRef2: any

      function Consumer1() {
        const context = useCSRFToken()
        addToFormDataRef1 = context.addToFormData
        return <div>Consumer 1</div>
      }

      function Consumer2() {
        const context = useCSRFToken()
        addToFormDataRef2 = context.addToFormData
        return <div>Consumer 2</div>
      }

      render(<CSRFTokenProvider>
          <Consumer1 />
          <Consumer2 />
        </CSRFTokenProvider>)

      // Both consumers should receive the same function reference
      expect(addToFormDataRef1).toBe(addToFormDataRef2)
    })
  })

  describe("Nested Providers", () => {
    it("should allow nested providers", () => {
      // Each CSRFTokenProvider calls useCSRF, so nested providers will create separate contexts
      vi.mocked(useCSRF).mockReturnValue({
        csrfToken: "test-token",
        isLoading: false,
        getToken: mockGetToken,
        addToFormData: mockAddToFormData,
        addToHeaders: mockAddToHeaders,
        submitForm: mockSubmitForm,
      })

      function Consumer() {
        const { csrfToken } = useCSRFToken()
        return <div data-testid="token">{csrfToken}</div>
      }

      // Render with nested providers - both should work
      render(<CSRFTokenProvider>
          <CSRFTokenProvider>
            <Consumer />
          </CSRFTokenProvider>
        </CSRFTokenProvider>)

      // The innermost provider should be used
      expect(screen.getByTestId("token")).toHaveTextContent("test-token")

      // Verify useCSRF was called for both providers
      expect(useCSRF).toHaveBeenCalled()
    })
  })
})
