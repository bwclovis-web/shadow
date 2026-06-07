import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ApiFetchError,
  apiFetch,
  getCSRFFromCookie,
  getCsrfHeaders,
  uploadImage,
} from "./api-client"

const mockDocumentCookie = (value: string) => {
  Object.defineProperty(document, "cookie", {
    writable: true,
    configurable: true,
    value,
  })
}

describe("api-client", () => {
  let originalCookie: PropertyDescriptor | undefined

  beforeEach(() => {
    originalCookie =
      Object.getOwnPropertyDescriptor(Document.prototype, "cookie") ||
      Object.getOwnPropertyDescriptor(document, "cookie")
    mockDocumentCookie("")
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalCookie) {
      Object.defineProperty(document, "cookie", originalCookie)
    }
  })

  describe("getCSRFFromCookie", () => {
    it("returns null when cookie is missing", () => {
      expect(getCSRFFromCookie()).toBeNull()
    })

    it("parses CSRF token from document cookie", () => {
      mockDocumentCookie("session=abc; _csrf=my-token; theme=dark")
      expect(getCSRFFromCookie()).toBe("my-token")
    })
  })

  describe("getCsrfHeaders", () => {
    it("returns empty object when token is missing", () => {
      expect(getCsrfHeaders()).toEqual({})
    })

    it("returns x-csrf-token header when token exists", () => {
      mockDocumentCookie("_csrf=header-token")
      expect(getCsrfHeaders()).toEqual({ "x-csrf-token": "header-token" })
    })
  })

  describe("apiFetch", () => {
    it("returns parsed JSON on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, data: "ok" }),
        })
      )

      const result = await apiFetch<{ success: boolean; data: string }>("/api/test")
      expect(result).toEqual({ success: true, data: "ok" })
    })

    it("throws ApiFetchError with message and status on failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          json: async () => ({ error: "Not allowed" }),
        })
      )

      await expect(apiFetch("/api/test")).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiFetchError)
        expect((err as ApiFetchError).message).toBe("Not allowed")
        expect((err as ApiFetchError).status).toBe(403)
        return true
      })
    })
  })

  describe("uploadImage", () => {
    it("returns url on successful upload", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, url: "https://cdn.example/img.jpg" }),
        })
      )

      const file = new File(["x"], "photo.jpg", { type: "image/jpeg" })
      const result = await uploadImage("/api/listing-images", file, {}, "listing.jpg")

      expect(result).toEqual({ url: "https://cdn.example/img.jpg" })
    })

    it("throws with API error message on failed upload", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ success: false, error: "Invalid file type" }),
        })
      )

      const file = new File(["x"], "photo.jpg", { type: "image/jpeg" })

      await expect(
        uploadImage("/api/listing-images", file, {}, "listing.jpg")
      ).rejects.toThrow("Invalid file type")
    })
  })
})
