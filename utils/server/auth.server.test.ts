import type { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthResult, AuthUser } from "./auth.server"

const mockGetSessionFromRequest = vi.fn()
vi.mock("@/utils/session-from-request.server", () => ({
  getSessionFromRequest: (...args: unknown[]) =>
    mockGetSessionFromRequest(...args),
}))

const mockRequireParticipationForUser = vi.fn()
vi.mock("@/utils/membership/entitlements.server", () => ({
  requireParticipationForUser: (...args: unknown[]) =>
    mockRequireParticipationForUser(...args),
}))

let authenticateUser: (
  request: Request,
  options?: { requireParticipation?: boolean }
) => Promise<AuthResult>

beforeEach(async () => {
  vi.clearAllMocks()
  mockRequireParticipationForUser.mockResolvedValue({ ok: true })
  const mod = await import("./auth.server")
  authenticateUser = mod.authenticateUser
})

const baseSessionUser = {
  id: "user-123",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  username: "testuser",
  role: "user" as UserRole,
  subscriptionStatus: "paid" as const,
  membershipTier: "free" as const,
  isEarlyAdopter: false,
  lastActiveAt: null,
}

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
    mockGetSessionFromRequest.mockResolvedValue({
      userId: baseSessionUser.id,
      user: baseSessionUser,
    })

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(true)
    expect(result.user).toEqual({
      id: "user-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      username: "testuser",
      role: "user",
      lastActiveAt: null,
      membershipTier: "free",
      subscriptionStatus: "paid",
    } satisfies AuthUser)
    expect(mockRequireParticipationForUser).toHaveBeenCalledWith({
      isEarlyAdopter: false,
      subscriptionStatus: "paid",
    })
  })

  it("returns 403 subscription_required when participation fails", async () => {
    mockGetSessionFromRequest.mockResolvedValue({
      userId: baseSessionUser.id,
      user: { ...baseSessionUser, subscriptionStatus: "free" },
    })
    mockRequireParticipationForUser.mockResolvedValue({
      ok: false,
      reason: "unpaid",
    })

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(false)
    expect(result.status).toBe(403)
    expect(result.code).toBe("subscription_required")
  })

  it("skips participation check when requireParticipation is false", async () => {
    mockGetSessionFromRequest.mockResolvedValue({
      userId: baseSessionUser.id,
      user: {
        ...baseSessionUser,
        firstName: null,
        lastName: null,
      },
    })

    const result = await authenticateUser(new Request("http://test"), {
      requireParticipation: false,
    })

    expect(result.success).toBe(true)
    expect(mockRequireParticipationForUser).not.toHaveBeenCalled()
  })

  it("returns 500 when getSessionFromRequest throws", async () => {
    mockGetSessionFromRequest.mockRejectedValue(new Error("Session error"))

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(false)
    expect(result.status).toBe(500)
    expect(result.error).toBe("Authentication failed")
  })
})
