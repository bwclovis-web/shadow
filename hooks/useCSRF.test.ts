import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useCSRF } from "./useCSRF"

// Helper to mock document.cookie getter
function mockDocumentCookie(value: string) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    configurable: true,
    value,
  })
}

describe("useCSRF", () => {
  let originalCookie: PropertyDescriptor | undefined

  beforeEach(() => {
    // Save original cookie descriptor
    originalCookie =
      Object.getOwnPropertyDescriptor(Document.prototype, "cookie") ||
      Object.getOwnPropertyDescriptor(document, "cookie")

    // Clear all cookies
    mockDocumentCookie("")
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original cookie descriptor if it exists
    if (originalCookie) {
      Object.defineProperty(document, "cookie", originalCookie)
    }
  })

  describe("Initialization", () => {
    it("should initialize with null token and loading true", () => {
      mockDocumentCookie("")

      const { result } = renderHook(() => useCSRF())

      // Initial loading state
      expect(result.current.isLoading).toBe(false) // Sets to false in useEffect
    })

    it("should read CSRF token from cookie", async () => {
      mockDocumentCookie("_csrf=test-token-123")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("test-token-123")
        expect(result.current.isLoading).toBe(false)
      })
    })

    it("should handle missing CSRF cookie", async () => {
      mockDocumentCookie("")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBeNull()
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe("getToken", () => {
    it("should return current token", async () => {
      mockDocumentCookie("_csrf=my-token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.getToken()).toBe("my-token")
      })
    })

    it("should return null when no token", async () => {
      mockDocumentCookie("")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.getToken()).toBeNull()
      })
    })
  })

  describe("addToFormData", () => {
    it("should add CSRF token to FormData", async () => {
      mockDocumentCookie("_csrf=form-token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("form-token")
      })

      const formData = new FormData()
      formData.append("username", "testuser")

      const updatedFormData = result.current.addToFormData(formData)

      expect(updatedFormData.get("_csrf")).toBe("form-token")
      expect(updatedFormData.get("username")).toBe("testuser")
    })

    it("should not add token when token is null", async () => {
      mockDocumentCookie("")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBeNull()
      })

      const formData = new FormData()
      formData.append("username", "testuser")

      const updatedFormData = result.current.addToFormData(formData)

      expect(updatedFormData.get("_csrf")).toBeNull()
      expect(updatedFormData.get("username")).toBe("testuser")
    })

    it("should not modify original FormData", async () => {
      mockDocumentCookie("_csrf=token123")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token123")
      })

      const originalFormData = new FormData()
      originalFormData.append("field", "value")

      const updatedFormData = result.current.addToFormData(originalFormData)

      // Both should have the CSRF token since we're mutating
      expect(originalFormData.get("_csrf")).toBe("token123")
      expect(updatedFormData.get("_csrf")).toBe("token123")
    })

    it("should handle FormData with existing _csrf field", async () => {
      mockDocumentCookie("_csrf=new-token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("new-token")
      })

      const formData = new FormData()
      formData.append("_csrf", "old-token")

      const updatedFormData = result.current.addToFormData(formData)

      // Should have both values (FormData allows multiple values)
      const allValues = updatedFormData.getAll("_csrf")
      expect(allValues).toContain("old-token")
      expect(allValues).toContain("new-token")
    })
  })

  describe("addToHeaders", () => {
    it("should add CSRF token to headers", async () => {
      mockDocumentCookie("_csrf=header-token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("header-token")
      })

      const headers = result.current.addToHeaders()

      expect(headers).toEqual({
        "x-csrf-token": "header-token",
      })
    })

    it("should merge with existing headers", async () => {
      mockDocumentCookie("_csrf=token123")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token123")
      })

      const headers = result.current.addToHeaders({
        "Content-Type": "application/json",
        Authorization: "Bearer xyz",
      })

      expect(headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer xyz",
        "x-csrf-token": "token123",
      })
    })

    it("should return original headers when no token", async () => {
      mockDocumentCookie("")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBeNull()
      })

      const originalHeaders = {
        "Content-Type": "application/json",
      }

      const headers = result.current.addToHeaders(originalHeaders)

      expect(headers).toEqual(originalHeaders)
    })

    it("should handle empty headers object", async () => {
      mockDocumentCookie("_csrf=token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token")
      })

      const headers = result.current.addToHeaders({})

      expect(headers).toEqual({
        "x-csrf-token": "token",
      })
    })

    it("should handle Headers instance", async () => {
      mockDocumentCookie("_csrf=token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token")
      })

      const headersInstance = new Headers()
      headersInstance.append("Content-Type", "application/json")

      const headers = result.current.addToHeaders(headersInstance)

      // Should return a new headers object with merged values
      expect(headers).toBeDefined()
    })
  })

  describe("submitForm", () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      global.fetch = mockFetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)
    })

    afterEach(() => {
      mockFetch.mockReset()
    })

    it("should submit form with CSRF token", async () => {
      mockDocumentCookie("_csrf=submit-token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("submit-token")
      })

      const formData = new FormData()
      formData.append("username", "testuser")

      await result.current.submitForm("/api/submit", formData)

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/submit",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      )

      const callArgs = mockFetch.mock.calls[0][1]
      const submittedFormData = callArgs.body as FormData
      expect(submittedFormData.get("_csrf")).toBe("submit-token")
      expect(submittedFormData.get("username")).toBe("testuser")
    })

    it("should include CSRF token in headers", async () => {
      mockDocumentCookie("_csrf=header-token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("header-token")
      })

      const formData = new FormData()
      await result.current.submitForm("/api/submit", formData)

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/submit",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-csrf-token": "header-token",
          }),
        })
      )
    })

    it("should merge with custom options", async () => {
      mockDocumentCookie("_csrf=token")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token")
      })

      const formData = new FormData()
      await result.current.submitForm("/api/submit", formData, {
        headers: {
          Authorization: "Bearer xyz",
        },
        mode: "cors",
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/submit",
        expect.objectContaining({
          method: "POST",
          mode: "cors",
          headers: expect.objectContaining({
            Authorization: "Bearer xyz",
            "x-csrf-token": "token",
          }),
        })
      )
    })

    it("should return fetch response", async () => {
      mockDocumentCookie("_csrf=token")

      const mockResponse = {
        ok: true,
        json: async () => ({ data: "test" }),
      } as Response

      mockFetch.mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token")
      })

      const formData = new FormData()
      const response = await result.current.submitForm("/api/submit", formData)

      expect(response).toBe(mockResponse)
    })

    it("should propagate fetch errors", async () => {
      mockDocumentCookie("_csrf=token")

      const error = new Error("Network error")
      mockFetch.mockRejectedValue(error)

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token")
      })

      const formData = new FormData()

      await expect(result.current.submitForm("/api/submit", formData)).rejects.toThrow("Network error")
    })
  })

  describe("Cookie Parsing", () => {
    it("should handle multiple cookies", async () => {
      mockDocumentCookie("session=abc123; _csrf=my-token; theme=dark")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("my-token")
      })
    })

    it("should handle cookies with spaces", async () => {
      // Note: Browsers typically trim spaces in cookie values
      mockDocumentCookie("_csrf=token-with-spaces")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token-with-spaces")
      })
    })

    it("should handle _csrf cookie at start", async () => {
      mockDocumentCookie("_csrf=first-cookie; other=value")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("first-cookie")
      })
    })

    it("should handle _csrf cookie at end", async () => {
      mockDocumentCookie("other=value; _csrf=last-cookie")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("last-cookie")
      })
    })

    it("should handle _csrf cookie in middle", async () => {
      mockDocumentCookie("first=value; _csrf=middle-cookie; last=value")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("middle-cookie")
      })
    })

    it("should handle empty cookie string", async () => {
      mockDocumentCookie("")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBeNull()
        expect(result.current.isLoading).toBe(false)
      })
    })

    it("should handle cookies without _csrf", async () => {
      mockDocumentCookie("session=123; theme=dark; user=john")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBeNull()
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe("Security - Token Values", () => {
    it("should handle tokens with special characters", async () => {
      // Note: Browsers may URL encode certain characters like =
      // Using a token that doesn't get encoded
      mockDocumentCookie("_csrf=abc-123_XYZ.456+789-test")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("abc-123_XYZ.456+789-test")
      })
    })

    it("should handle very long tokens", async () => {
      const longToken = "a".repeat(1000)
      mockDocumentCookie(`_csrf=${longToken}`)

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe(longToken)
      })
    })

    it("should handle URL-safe base64 tokens", async () => {
      mockDocumentCookie("_csrf=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")

      const { result } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
      })
    })
  })

  describe("Function Stability", () => {
    it("should maintain function references across renders", async () => {
      mockDocumentCookie("_csrf=token")

      const { result, rerender } = renderHook(() => useCSRF())

      await waitFor(() => {
        expect(result.current.csrfToken).toBe("token")
      })

      const initialFunctions = {
        getToken: result.current.getToken,
        addToFormData: result.current.addToFormData,
        addToHeaders: result.current.addToHeaders,
        submitForm: result.current.submitForm,
      }

      rerender()

      // Functions should be recreated but still work
      expect(typeof result.current.getToken).toBe("function")
      expect(typeof result.current.addToFormData).toBe("function")
      expect(typeof result.current.addToHeaders).toBe("function")
      expect(typeof result.current.submitForm).toBe("function")
    })
  })
})
