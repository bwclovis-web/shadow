import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateSession = vi.fn().mockResolvedValue({
  accessToken: "access",
  refreshToken: "refresh",
})
vi.mock("@/utils/security/session-manager.server", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}))
vi.mock("@/models/user.server", () => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  FreeSignupLimitReachedError: class FreeSignupLimitReachedError extends Error {
    override name = "FreeSignupLimitReachedError"
  },
}))
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
}))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    const err = new Error("NEXT_REDIRECT")
    ;(err as unknown as { digest: string }).digest = "NEXT_REDIRECT"
    throw err
  }),
}))
vi.mock("@/utils/server/csrf.server", () => ({ requireCSRF: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/utils/server/user-limit.server", () => ({
  canSignupForFree: vi.fn().mockResolvedValue(true),
}))
vi.mock("@/utils/server/stripe.server", () => ({
  getCheckoutSession: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/utils/api-validation.server", () => ({
  validateRateLimit: vi.fn(),
}))
vi.mock("@/utils/rate-limit-config.server", () => ({
  getSignupSubscribeRateLimits: vi.fn().mockReturnValue({ signup: { max: 10, windowMs: 60000 } }),
}))

import { createUser, getUserByEmail } from "@/models/user.server"
import { signUpAction } from "./actions"

describe("signUpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSession.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    })
    vi.mocked(getUserByEmail).mockResolvedValue(null)
    vi.mocked(createUser).mockResolvedValue({
      id: "user-new-id",
      username: "NoirShadow_7",
      tokenVersion: 0,
    } as Awaited<ReturnType<typeof createUser>>)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("calls createSession with tokenVersion from created user (free sign-up path)", async () => {
    const formData = new FormData()
    formData.set("email", "new@example.com")
    formData.set("password", "ValidPassword1!")
    formData.set("confirmPassword", "ValidPassword1!")
    formData.set("acceptTerms", "on")

    try {
      await signUpAction(null, formData)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toBe("NEXT_REDIRECT")
    }

    expect(mockCreateSession).toHaveBeenCalledTimes(1)
    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: "user-new-id",
      tokenVersion: 0,
    })
  })

  it("returns 'Email already taken' when getUserByEmail finds existing user", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-id",
      email: "taken@example.com",
    } as Awaited<ReturnType<typeof getUserByEmail>>)
    const formData = new FormData()
    formData.set("email", "taken@example.com")
    formData.set("password", "ValidPassword1!")
    formData.set("confirmPassword", "ValidPassword1!")
    formData.set("acceptTerms", "on")

    const result = await signUpAction(null, formData)

    expect(result).toEqual({ error: "Email already taken", submission: undefined })
    expect(getUserByEmail).toHaveBeenCalledWith("taken@example.com")
    expect(createUser).not.toHaveBeenCalled()
  })

  it("calls createSession with tokenVersion when createUser returns non-zero version", async () => {
    vi.mocked(createUser).mockResolvedValue({
      id: "user-paid-id",
      username: "DarkAlley_42",
      tokenVersion: 1,
    } as Awaited<ReturnType<typeof createUser>>)
    const formData = new FormData()
    formData.set("email", "paid@example.com")
    formData.set("password", "ValidPassword1!")
    formData.set("confirmPassword", "ValidPassword1!")
    formData.set("acceptTerms", "on")

    try {
      await signUpAction(null, formData)
    } catch {
      // redirect throws
    }

    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: "user-paid-id",
      tokenVersion: 1,
    })
  })
})
