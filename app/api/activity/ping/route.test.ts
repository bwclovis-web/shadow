import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authenticateUserMock = vi.fn()
const requireCSRFMock = vi.fn()
const touchUserLastActiveMock = vi.fn()

vi.mock("@/utils/server/auth.server", () => ({
  authenticateUser: (...args: unknown[]) => authenticateUserMock(...args),
}))

vi.mock("@/utils/server/csrf.server", () => ({
  requireCSRF: (...args: unknown[]) => requireCSRFMock(...args),
  CSRFError: class CSRFError extends Error {
    statusCode = 403
  },
}))

vi.mock("@/models/user-activity.server", () => ({
  touchUserLastActive: (...args: unknown[]) => touchUserLastActiveMock(...args),
}))

import { POST } from "./route"

describe("POST /api/activity/ping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateUserMock.mockResolvedValue({
      success: true,
      user: { id: "user-1" },
    })
    requireCSRFMock.mockResolvedValue(undefined)
    touchUserLastActiveMock.mockResolvedValue(undefined)
  })

  it("requires CSRF before updating activity", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/activity/ping", {
        method: "POST",
        headers: { "x-csrf-token": "token" },
      })
    )

    expect(response.status).toBe(200)
    expect(requireCSRFMock).toHaveBeenCalled()
    expect(touchUserLastActiveMock).toHaveBeenCalledWith("user-1")
  })

  it("returns 403 when CSRF validation fails", async () => {
    const { CSRFError } = await import("@/utils/server/csrf.server")
    requireCSRFMock.mockRejectedValue(new CSRFError("Invalid security token"))

    const response = await POST(
      new NextRequest("http://localhost/api/activity/ping", { method: "POST" })
    )

    expect(response.status).toBe(403)
    expect(touchUserLastActiveMock).not.toHaveBeenCalled()
  })
})
