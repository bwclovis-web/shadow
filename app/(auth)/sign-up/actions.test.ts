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
const mockRedirect = vi.fn(() => {
  const err = new Error("NEXT_REDIRECT")
  ;(err as unknown as { digest: string }).digest = "NEXT_REDIRECT"
  throw err
})
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))
vi.mock("@/utils/server/csrf.server", () => ({ requireCSRF: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/utils/security/turnstile.server", () => ({
  getTurnstileTokenFromFormData: vi.fn().mockReturnValue("token"),
  verifyTurnstileToken: vi.fn().mockResolvedValue({ ok: true }),
}))
const mockGetCheckoutSession = vi.fn()
vi.mock("@/utils/server/stripe.server", () => ({
  getCheckoutSession: (...args: unknown[]) => mockGetCheckoutSession(...args),
}))
vi.mock("@/utils/api-validation.server", () => ({
  validateRateLimit: vi.fn(),
}))
vi.mock("@/utils/rate-limit-config.server", () => ({
  getSignupSubscribeRateLimits: vi.fn().mockReturnValue({
    signup: { max: 10, windowMs: 60000 },
  }),
}))
vi.mock("@/utils/security/auth-cookie.server", () => ({
  getAuthCookieFlags: vi.fn().mockReturnValue({ httpOnly: true, path: "/" }),
}))
vi.mock("@/utils/user", () => ({
  getProfilePathForUser: vi.fn().mockReturnValue("/testuser/profile"),
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

  it("redirects to subscribe when session_id is missing", async () => {
    const formData = new FormData()
    formData.set("email", "new@example.com")
    formData.set("password", "ValidPassword1!")
    formData.set("confirmPassword", "ValidPassword1!")
    formData.set("acceptTerms", "on")

    await expect(signUpAction(null, formData)).rejects.toThrow("NEXT_REDIRECT")
    expect(mockRedirect).toHaveBeenCalledWith(
      "/subscribe?tier=member&redirect=/sign-up"
    )
    expect(createUser).not.toHaveBeenCalled()
  })

  it("returns Email already taken when email exists (with valid checkout session)", async () => {
    mockGetCheckoutSession.mockResolvedValue({
      status: "complete",
      customer_details: { email: "taken@example.com" },
      metadata: { membership_tier: "member" },
    })
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: "existing-id",
      email: "taken@example.com",
    } as Awaited<ReturnType<typeof getUserByEmail>>)
    const formData = new FormData()
    formData.set("session_id", "cs_test")
    formData.set("email", "taken@example.com")
    formData.set("password", "ValidPassword1!")
    formData.set("confirmPassword", "ValidPassword1!")
    formData.set("acceptTerms", "on")

    const result = await signUpAction(null, formData)

    expect(result).toEqual({ error: "Email already taken", submission: undefined })
    expect(createUser).not.toHaveBeenCalled()
  })

  it("creates paid user with membershipTier from checkout metadata", async () => {
    mockGetCheckoutSession.mockResolvedValue({
      status: "complete",
      customer_details: { email: "paid@example.com" },
      metadata: { membership_tier: "premium" },
    })
    const formData = new FormData()
    formData.set("session_id", "cs_test")
    formData.set("email", "paid@example.com")
    formData.set("password", "ValidPassword1!")
    formData.set("confirmPassword", "ValidPassword1!")
    formData.set("acceptTerms", "on")

    await expect(signUpAction(null, formData)).rejects.toThrow("NEXT_REDIRECT")

    expect(createUser).toHaveBeenCalledWith(
      formData,
      expect.objectContaining({
        subscriptionStatus: "paid",
        membershipTier: "premium",
        isEarlyAdopter: false,
      })
    )
    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: "user-new-id",
      tokenVersion: 0,
    })
  })
})
