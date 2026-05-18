import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateSession = vi.fn().mockResolvedValue({
  accessToken: "access",
  refreshToken: "refresh",
})
const mockRedirect = vi.fn(() => {
  const err = new Error("NEXT_REDIRECT")
  ;(err as unknown as { digest: string }).digest = "NEXT_REDIRECT"
  throw err
})

vi.mock("@/utils/security/session-manager.server", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}))
vi.mock("@/models/user.server", () => ({
  signInCustomer: vi.fn(),
}))
vi.mock("@/models/user.query", () => ({
  updateUser: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/utils/username-generator.server", () => ({
  generateUniqueUsername: vi.fn().mockResolvedValue("NoirShadow_7"),
}))
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn() }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
vi.mock("@/utils/api-validation.server", () => ({
  validateRateLimit: vi.fn(),
}))
vi.mock("@/models/two-factor.server", () => ({
  isTwoFactorEnabled: vi.fn().mockReturnValue(false),
}))
vi.mock("@/utils/rate-limit-config.server", () => ({
  getAuthRateLimits: vi.fn().mockReturnValue({
    signIn: { max: 5, windowMs: 60_000 },
    verify2fa: { max: 10, windowMs: 300_000 },
  }),
}))
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))
vi.mock("@/utils/server/csrf.server", () => ({ requireCSRF: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/utils/security/login-security.server", () => ({
  isLoginHeuristicsEnabled: vi.fn().mockReturnValue(false),
  getLoginContext: vi.fn(),
  recordLoginAttempt: vi.fn(),
  assertAccountNotLocked: vi.fn(),
}))

import { isTwoFactorEnabled } from "@/models/two-factor.server"
import { updateUser } from "@/models/user.query"
import { signInCustomer } from "@/models/user.server"
import { generateUniqueUsername } from "@/utils/username-generator.server"
import { signInAction } from "./actions"

const mockSignInCustomer = vi.mocked(signInCustomer)
const mockIsTwoFactorEnabled = vi.mocked(isTwoFactorEnabled)
const mockUpdateUser = vi.mocked(updateUser)
const mockGenerateUniqueUsername = vi.mocked(generateUniqueUsername)

function formData(email = "user@example.com", password = "ValidPassword1!") {
  const fd = new FormData()
  fd.set("email", email)
  fd.set("password", password)
  return fd
}

describe("signInAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSession.mockResolvedValue({ accessToken: "a", refreshToken: "r" })
    mockIsTwoFactorEnabled.mockReturnValue(false)
  })

  it("redirects to verify-2fa when 2FA is enabled", async () => {
    mockSignInCustomer.mockResolvedValue({
      kind: "success",
      user: {
        id: "user-2fa",
        username: "TwoFaUser",
        tokenVersion: 0,
        twoFactorEnabledAt: new Date(),
        totpSecretEncrypted: "enc",
      },
    } as Awaited<ReturnType<typeof signInCustomer>>)
    mockIsTwoFactorEnabled.mockReturnValue(true)

    try {
      await signInAction(null, formData())
    } catch (e) {
      expect((e as Error).message).toBe("NEXT_REDIRECT")
    }

    expect(mockCreateSession).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith("/sign-in/verify-2fa")
  })

  it("returns error when credentials are invalid", async () => {
    mockSignInCustomer.mockResolvedValue({ kind: "not_found" })
    const result = await signInAction(null, formData())
    expect(result).toEqual({ error: "Invalid email or password" })
    expect(mockCreateSession).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("returns suspended error when user is banned", async () => {
    mockSignInCustomer.mockResolvedValue({
      kind: "success",
      user: {
        id: "banned-user",
        username: "BannedUser",
        tokenVersion: 0,
        isBanned: true,
      },
    } as Awaited<ReturnType<typeof signInCustomer>>)

    const result = await signInAction(null, formData())
    expect(result).toEqual({ error: "Your account has been suspended" })
    expect(mockCreateSession).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("when user has username, does not call generateUniqueUsername or updateUser and redirects to profile", async () => {
    mockSignInCustomer.mockResolvedValue({
      kind: "success",
      user: {
        id: "user-1",
        username: "ExistingUser",
        tokenVersion: 0,
      },
    } as Awaited<ReturnType<typeof signInCustomer>>)

    try {
      await signInAction(null, formData())
    } catch (e) {
      expect((e as Error).message).toBe("NEXT_REDIRECT")
    }

    expect(mockGenerateUniqueUsername).not.toHaveBeenCalled()
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith("/existinguser/profile")
  })

  it("when user has null username, generates username, updates user, and redirects with new slug", async () => {
    mockSignInCustomer.mockResolvedValue({
      kind: "success",
      user: {
        id: "legacy-user-id",
        username: null,
        tokenVersion: 0,
      },
    } as Awaited<ReturnType<typeof signInCustomer>>)
    mockGenerateUniqueUsername.mockResolvedValue("DarkAlley_42")

    try {
      await signInAction(null, formData())
    } catch (e) {
      expect((e as Error).message).toBe("NEXT_REDIRECT")
    }

    expect(mockGenerateUniqueUsername).toHaveBeenCalledTimes(1)
    expect(mockUpdateUser).toHaveBeenCalledTimes(1)
    expect(mockUpdateUser).toHaveBeenCalledWith("legacy-user-id", {
      username: "DarkAlley_42",
    })
    expect(mockRedirect).toHaveBeenCalledWith("/darkalley-42/profile")
  })

  it("when user has empty string username, backfills and redirects with new slug", async () => {
    mockSignInCustomer.mockResolvedValue({
      kind: "success",
      user: {
        id: "user-empty",
        username: "   ",
        tokenVersion: 0,
      },
    } as Awaited<ReturnType<typeof signInCustomer>>)
    mockGenerateUniqueUsername.mockResolvedValue("PaleShadow_99")

    try {
      await signInAction(null, formData())
    } catch {
      // redirect throws
    }

    expect(mockGenerateUniqueUsername).toHaveBeenCalledTimes(1)
    expect(mockUpdateUser).toHaveBeenCalledWith("user-empty", {
      username: "PaleShadow_99",
    })
    expect(mockRedirect).toHaveBeenCalledWith("/paleshadow-99/profile")
  })
})
