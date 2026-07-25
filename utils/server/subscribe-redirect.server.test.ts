import { describe, expect, it } from "vitest"

import { sanitizeRedirectPath } from "@/utils/server/subscribe-redirect.server"

describe("sanitizeRedirectPath", () => {
  it("defaults missing or unsafe paths to /sign-up", () => {
    expect(sanitizeRedirectPath(null)).toBe("/sign-up")
    expect(sanitizeRedirectPath(undefined)).toBe("/sign-up")
    expect(sanitizeRedirectPath("")).toBe("/sign-up")
    expect(sanitizeRedirectPath("https://evil.example")).toBe("/sign-up")
    expect(sanitizeRedirectPath("//evil.example")).toBe("/sign-up")
  })

  it("allows same-origin relative paths", () => {
    expect(sanitizeRedirectPath("/sign-up")).toBe("/sign-up")
    expect(sanitizeRedirectPath("/sign-up?foo=1")).toBe("/sign-up?foo=1")
  })
})
