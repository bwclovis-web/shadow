import type { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthResult, AuthUser } from "./auth.server"

const mockGetSessionFromRequest = vi.fn()
vi.mock("@/utils/session-from-request.server", () => ({
  getSessionFromRequest: (...args: unknown[]) =>
    mockGetSessionFromRequest(...args),
}))

const mockRequireParticipation = vi.fn()
vi.mock("@/utils/membership/entitlements.server", () => ({
  requireParticipation: (...args: unknown[]) => mockRequireParticipation(...args),
}))

let authenticateUser: (
  request: Request,
  options?: { requireParticipation?: boolean }
) => Promise<AuthResult>

beforeEach(async () => {
  vi.clearAllMocks()
  mockRequireParticipation.mockResolvedValue({ ok: true })
  const mod = await import("./auth.server")
  authenticateUser = mod.authenticateUser
})

describe("authenticateUser", () => {
  it("returns 401 when session is null", async () => {
    mockGetSessionFromRequest.mockResolvedValue(null)

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toBe("User not authenticated")
    expect(result.user).toBeUndefined()
  })

  it("returns 401 when session has no user", async () => {
    mockGetSessionFromRequest.mockResolvedValue({ userId: "user-1" })

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toBe("User not found")
    expect(result.user).toBeUndefined()
  })

  it("returns success and user when session has user and participation ok", async () => {
    const sessionUser: AuthUser = {
      id: "user-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      username: "testuser",
      role: "user" as UserRole,
    }
    mockGetSessionFromRequest.mockResolvedValue({
      userId: sessionUser.id,
      user: sessionUser,
    })

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(true)
    expect(result.user).toEqual(sessionUser)
    expect(mockRequireParticipation).toHaveBeenCalledWith("user-123")
  })

  it("returns 403 subscription_required when participation fails", async () => {
    const sessionUser: AuthUser = {
      id: "user-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      username: "testuser",
      role: "user" as UserRole,
    }
    mockGetSessionFromRequest.mockResolvedValue({
      userId: sessionUser.id,
      user: sessionUser,
    })
    mockRequireParticipation.mockResolvedValue({ ok: false, reason: "unpaid" })

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(false)
    expect(result.status).toBe(403)
    expect(result.code).toBe("subscription_required")
  })

  it("skips participation check when requireParticipation is false", async () => {
    const sessionUser: AuthUser = {
      id: "user-123",
      email: "test@example.com",
      firstName: null,
      lastName: null,
      username: "testuser",
      role: "user" as UserRole,
    }
    mockGetSessionFromRequest.mockResolvedValue({
      userId: sessionUser.id,
      user: sessionUser,
    })

    const result = await authenticateUser(new Request("http://test"), {
      requireParticipation: false,
    })

    expect(result.success).toBe(true)
    expect(mockRequireParticipation).not.toHaveBeenCalled()
  })

  it("returns 500 when getSessionFromRequest throws", async () => {
    mockGetSessionFromRequest.mockRejectedValue(new Error("Session error"))

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(false)
    expect(result.status).toBe(500)
    expect(result.error).toBe("Authentication failed")
  })
})
