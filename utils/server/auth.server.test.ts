import type { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthResult, AuthUser } from "./auth.server"

const mockGetSessionFromRequest = vi.fn()
vi.mock("@/utils/session-from-request.server", () => ({
  getSessionFromRequest: (...args: unknown[]) =>
    mockGetSessionFromRequest(...args),
}))

let authenticateUser: (request: Request) => Promise<AuthResult>

beforeEach(async () => {
  vi.clearAllMocks()
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

  it("returns success and user with AuthUser shape when session has user", async () => {
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
    expect(result.user).toBeDefined()
    expect(result.user).toEqual(sessionUser)
    expect(result.user!.id).toBe("user-123")
    expect(result.user!.email).toBe("test@example.com")
    expect(result.user!.role).toBe("user")
  })

  it("returns 500 and does not expose user when getSessionFromRequest throws", async () => {
    mockGetSessionFromRequest.mockRejectedValue(new Error("Session error"))

    const result = await authenticateUser(new Request("http://test"))

    expect(result.success).toBe(false)
    expect(result.status).toBe(500)
    expect(result.error).toBe("Authentication failed")
    expect(result.user).toBeUndefined()
  })

  it("passes request and includeUser: true to getSessionFromRequest", async () => {
    mockGetSessionFromRequest.mockResolvedValue(null)

    const request = new Request("http://test", {
      headers: { cookie: "accessToken=abc" },
    })
    await authenticateUser(request)

    expect(mockGetSessionFromRequest).toHaveBeenCalledTimes(1)
    expect(mockGetSessionFromRequest).toHaveBeenCalledWith(request, {
      includeUser: true,
    })
  })
})
