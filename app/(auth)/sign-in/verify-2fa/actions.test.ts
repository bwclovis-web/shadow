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
vi.mock("@/models/two-factor.server", () => ({
  verifyTwoFactorAtSignIn: vi.fn(),
}))
vi.mock("@/models/user.query", () => ({
  getUserById: vi.fn(),
}))
vi.mock("@/models/user-activity.server", () => ({
  touchUserLastActive: vi.fn(),
}))
vi.mock("@/utils/security/two-factor-audit.server", () => ({
  logTwoFactorAudit: vi.fn(),
}))
vi.mock("@/utils/security/auth-session-cookies.server", () => ({
  setSessionCookies: vi.fn(),
  clearPending2faCookies: vi.fn(),
}))
vi.mock("@/utils/security/pending-2fa.server", () => ({
  getPending2faCookieName: () => "pending2fa",
  verifyPending2faToken: vi.fn(),
}))
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "valid-pending-token" }),
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}))
vi.mock("@/utils/api-validation.server", () => ({
  validateRateLimit: vi.fn(),
}))
vi.mock("@/utils/rate-limit-config.server", () => ({
  getAuthRateLimits: vi.fn().mockReturnValue({
    verify2fa: { max: 10, windowMs: 300_000 },
  }),
}))
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))
vi.mock("@/utils/server/csrf.server", () => ({
  requireCSRF: vi.fn().mockResolvedValue(undefined),
}))

import { getUserById } from "@/models/user.query"
import { verifyTwoFactorAtSignIn } from "@/models/two-factor.server"
import { verifyPending2faToken } from "@/utils/security/pending-2fa.server"
import { verify2faAction } from "./actions"

const mockVerifyTwoFactor = vi.mocked(verifyTwoFactorAtSignIn)
const mockVerifyPending = vi.mocked(verifyPending2faToken)
const mockGetUserById = vi.mocked(getUserById)

const formData = (code = "123456", useBackup = false) => {
  const fd = new FormData()
  fd.set("code", code)
  fd.set("useBackupCode", String(useBackup))
  return fd
}

describe("verify2faAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyPending.mockReturnValue({ userId: "user-1" })
    mockVerifyTwoFactor.mockResolvedValue(true)
    mockGetUserById.mockResolvedValue({
      id: "user-1",
      username: "TestUser",
      tokenVersion: 0,
      isBanned: false,
    } as Awaited<ReturnType<typeof getUserById>>)
  })

  it("returns error for invalid code", async () => {
    mockVerifyTwoFactor.mockResolvedValue(false)
    const result = await verify2faAction(null, formData())
    expect(result).toEqual({ error: "Invalid verification code" })
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it("creates session and redirects on success", async () => {
    try {
      await verify2faAction(null, formData())
    } catch (e) {
      expect((e as Error).message).toBe("NEXT_REDIRECT")
    }
    expect(mockCreateSession).toHaveBeenCalledWith({
      userId: "user-1",
      tokenVersion: 0,
    })
    expect(mockRedirect).toHaveBeenCalledWith("/testuser/profile")
  })
})
