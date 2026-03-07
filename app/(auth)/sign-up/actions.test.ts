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
  getUserByName: vi.fn(),
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

import { createUser, getUserByName } from "@/models/user.server"
import { signUpAction } from "./actions"

describe("signUpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSession.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    })
    vi.mocked(getUserByName).mockResolvedValue(null)
    vi.mocked(createUser).mockResolvedValue({
      id: "user-new-id",
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

  it("calls createSession with tokenVersion when createUser returns non-zero version", async () => {
    vi.mocked(createUser).mockResolvedValue({
      id: "user-paid-id",
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
