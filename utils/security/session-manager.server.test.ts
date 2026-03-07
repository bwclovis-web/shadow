import jwt from "jsonwebtoken"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/models/user.query", () => ({
  getUserTokenVersion: vi.fn(),
}))
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

const TEST_JWT_SECRET = "test-secret-at-least-32-characters-long!!"

let createAccessToken: (userId: string, tokenVersion: number) => string
let createRefreshToken: (userId: string, tokenVersion: number) => string
let createSession: (opts: {
  userId: string
  tokenVersion?: number
  userAgent?: string
  ipAddress?: string
}) => Promise<{ accessToken: string; refreshToken: string; sessionId: string; expiresAt: Date }>
let verifyAccessToken: (token: string) => Promise<{ userId: string } | null>
let verifyRefreshToken: (token: string) => Promise<{ userId: string } | null>
let refreshAccessToken: (refreshToken: string) => Promise<{
  accessToken: string
  refreshToken: string
  userId: string
  sessionId: string
}>
let invalidateAllUserSessions: (userId: string) => Promise<void>
let invalidateSession: (sessionId: string) => Promise<void>
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET)
  const mod = await import("./session-manager.server")
  createAccessToken = mod.createAccessToken
  createRefreshToken = mod.createRefreshToken
  createSession = mod.createSession
  verifyAccessToken = mod.verifyAccessToken
  verifyRefreshToken = mod.verifyRefreshToken
  refreshAccessToken = mod.refreshAccessToken
  invalidateAllUserSessions = mod.invalidateAllUserSessions
  invalidateSession = mod.invalidateSession
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe("createAccessToken", () => {
  it("includes userId, type, and tokenVersion in JWT payload", () => {
    const token = createAccessToken("user-123", 3)
    const payload = jwt.decode(token) as { userId?: string; type?: string; tokenVersion?: number }
    expect(payload).toBeDefined()
    expect(payload.userId).toBe("user-123")
    expect(payload.type).toBe("access")
    expect(payload.tokenVersion).toBe(3)
  })

  it("includes tokenVersion 0 when passed 0", () => {
    const token = createAccessToken("user-0", 0)
    const payload = jwt.decode(token) as { tokenVersion?: number }
    expect(payload.tokenVersion).toBe(0)
  })

  it("produces a token that can be verified with the same secret", () => {
    const token = createAccessToken("user-456", 1)
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as { userId: string; tokenVersion: number }
    expect(decoded.userId).toBe("user-456")
    expect(decoded.tokenVersion).toBe(1)
  })
})

describe("createRefreshToken", () => {
  it("includes userId, type, and tokenVersion in JWT payload", () => {
    const token = createRefreshToken("user-789", 2)
    const payload = jwt.decode(token) as { userId?: string; type?: string; tokenVersion?: number }
    expect(payload).toBeDefined()
    expect(payload.userId).toBe("user-789")
    expect(payload.type).toBe("refresh")
    expect(payload.tokenVersion).toBe(2)
  })

  it("includes tokenVersion 0 when passed 0", () => {
    const token = createRefreshToken("user-0", 0)
    const payload = jwt.decode(token) as { tokenVersion?: number }
    expect(payload.tokenVersion).toBe(0)
  })

  it("produces a token that can be verified with the same secret", () => {
    const token = createRefreshToken("user-abc", 1)
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as { userId: string; tokenVersion: number }
    expect(decoded.userId).toBe("user-abc")
    expect(decoded.tokenVersion).toBe(1)
  })
})

describe("createSession", () => {
  beforeEach(async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockReset()
  })

  it("uses provided tokenVersion in access and refresh tokens", async () => {
    const { accessToken, refreshToken } = await createSession({
      userId: "user-1",
      tokenVersion: 5,
    })
    const accessPayload = jwt.decode(accessToken) as { userId: string; tokenVersion: number }
    const refreshPayload = jwt.decode(refreshToken) as { userId: string; tokenVersion: number }
    expect(accessPayload.userId).toBe("user-1")
    expect(accessPayload.tokenVersion).toBe(5)
    expect(refreshPayload.userId).toBe("user-1")
    expect(refreshPayload.tokenVersion).toBe(5)
  })

  it("calls getUserTokenVersion when tokenVersion is omitted and uses result in tokens", async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(3)

    const { accessToken, refreshToken } = await createSession({ userId: "user-2" })

    expect(getUserTokenVersion).toHaveBeenCalledWith("user-2")
    const accessPayload = jwt.decode(accessToken) as { tokenVersion: number }
    const refreshPayload = jwt.decode(refreshToken) as { tokenVersion: number }
    expect(accessPayload.tokenVersion).toBe(3)
    expect(refreshPayload.tokenVersion).toBe(3)
  })

  it("uses 0 when tokenVersion is omitted and getUserTokenVersion returns null", async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(null)

    const { accessToken, refreshToken } = await createSession({ userId: "user-3" })

    const accessPayload = jwt.decode(accessToken) as { tokenVersion: number }
    const refreshPayload = jwt.decode(refreshToken) as { tokenVersion: number }
    expect(accessPayload.tokenVersion).toBe(0)
    expect(refreshPayload.tokenVersion).toBe(0)
  })
})

describe("verifyAccessToken", () => {
  beforeEach(async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockReset()
  })

  it("returns { userId } when token is valid and payload.tokenVersion matches current", async () => {
    const token = createAccessToken("user-ok", 2)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(2)

    const result = await verifyAccessToken(token)

    expect(result).toEqual({ userId: "user-ok" })
    expect(getUserTokenVersion).toHaveBeenCalledWith("user-ok")
  })

  it("returns null when payload.tokenVersion < currentVersion", async () => {
    const token = createAccessToken("user-stale", 1)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(2)

    const result = await verifyAccessToken(token)

    expect(result).toBeNull()
  })

  it("returns { userId } when payload.tokenVersion equals currentVersion", async () => {
    const token = createAccessToken("user-eq", 3)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(3)

    const result = await verifyAccessToken(token)

    expect(result).toEqual({ userId: "user-eq" })
  })

  it("returns null when getUserTokenVersion returns null (user not found)", async () => {
    const token = createAccessToken("user-missing", 0)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(null)

    const result = await verifyAccessToken(token)

    expect(result).toBeNull()
  })

  it("returns null for invalid or malformed token", async () => {
    const result = await verifyAccessToken("invalid.jwt.token")
    expect(result).toBeNull()
  })

  it("returns null for refresh token (wrong type)", async () => {
    const refreshToken = createRefreshToken("user-1", 0)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(0)

    const result = await verifyAccessToken(refreshToken)

    expect(result).toBeNull()
  })

  it("returns null when payload has no tokenVersion (legacy token)", async () => {
    const tokenWithoutVersion = jwt.sign(
      { userId: "user-legacy", type: "access", iat: Math.floor(Date.now() / 1000) },
      TEST_JWT_SECRET,
      { expiresIn: "1h" }
    )
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(0)

    const result = await verifyAccessToken(tokenWithoutVersion)

    expect(result).toBeNull()
  })
})

describe("verifyRefreshToken", () => {
  beforeEach(async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockReset()
  })

  it("returns { userId } when token is valid and payload.tokenVersion matches current", async () => {
    const token = createRefreshToken("user-ok", 2)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(2)

    const result = await verifyRefreshToken(token)

    expect(result).toEqual({ userId: "user-ok" })
    expect(getUserTokenVersion).toHaveBeenCalledWith("user-ok")
  })

  it("returns null when payload.tokenVersion < currentVersion", async () => {
    const token = createRefreshToken("user-stale", 1)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(2)

    const result = await verifyRefreshToken(token)

    expect(result).toBeNull()
  })

  it("returns { userId } when payload.tokenVersion equals currentVersion", async () => {
    const token = createRefreshToken("user-eq", 3)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(3)

    const result = await verifyRefreshToken(token)

    expect(result).toEqual({ userId: "user-eq" })
  })

  it("returns null when getUserTokenVersion returns null (user not found)", async () => {
    const token = createRefreshToken("user-missing", 0)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(null)

    const result = await verifyRefreshToken(token)

    expect(result).toBeNull()
  })

  it("returns null for invalid or malformed token", async () => {
    const result = await verifyRefreshToken("invalid.jwt.token")
    expect(result).toBeNull()
  })

  it("returns null for access token (wrong type)", async () => {
    const accessToken = createAccessToken("user-1", 0)
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(0)

    const result = await verifyRefreshToken(accessToken)

    expect(result).toBeNull()
  })

  it("returns null when payload has no tokenVersion (legacy token)", async () => {
    const tokenWithoutVersion = jwt.sign(
      { userId: "user-legacy", type: "refresh", iat: Math.floor(Date.now() / 1000) },
      TEST_JWT_SECRET,
      { expiresIn: "7d" }
    )
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(0)

    const result = await verifyRefreshToken(tokenWithoutVersion)

    expect(result).toBeNull()
  })
})

describe("refreshAccessToken", () => {
  beforeEach(async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockReset()
  })

  it("returns new access and refresh tokens with current tokenVersion", async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(4)
    const oldRefreshToken = createRefreshToken("user-refresh", 4)

    const result = await refreshAccessToken(oldRefreshToken)

    expect(result.userId).toBe("user-refresh")
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(result.sessionId).toBeDefined()
    const accessPayload = jwt.decode(result.accessToken) as { userId: string; tokenVersion: number }
    const refreshPayload = jwt.decode(result.refreshToken) as { userId: string; tokenVersion: number }
    expect(accessPayload.userId).toBe("user-refresh")
    expect(accessPayload.tokenVersion).toBe(4)
    expect(refreshPayload.userId).toBe("user-refresh")
    expect(refreshPayload.tokenVersion).toBe(4)
    expect(getUserTokenVersion).toHaveBeenCalledWith("user-refresh")
  })

  it("uses current tokenVersion from DB even when refresh token had older version (already verified)", async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(5)
    const oldRefreshToken = createRefreshToken("user-v", 5)

    const result = await refreshAccessToken(oldRefreshToken)

    const accessPayload = jwt.decode(result.accessToken) as { tokenVersion: number }
    expect(accessPayload.tokenVersion).toBe(5)
  })

  it("throws when refresh token is invalid", async () => {
    const { getUserTokenVersion } = await import("@/models/user.query")
    vi.mocked(getUserTokenVersion).mockResolvedValue(0)

    await expect(refreshAccessToken("invalid.jwt.token")).rejects.toThrow("Invalid refresh token")
  })
})

describe("invalidateAllUserSessions", () => {
  beforeEach(async () => {
    const { prisma } = await import("@/lib/db")
    vi.mocked(prisma.user.update).mockClear()
  })

  it("calls prisma.user.update with userId and tokenVersion increment", async () => {
    await invalidateAllUserSessions("user-to-invalidate")

    const { prisma } = await import("@/lib/db")
    expect(prisma.user.update).toHaveBeenCalledTimes(1)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-to-invalidate" },
      data: { tokenVersion: { increment: 1 } },
    })
  })
})

describe("invalidateSession", () => {
  it("is a no-op and does not call prisma", async () => {
    const { prisma } = await import("@/lib/db")
    vi.mocked(prisma.user.update).mockClear()

    await invalidateSession("any-session-id")

    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
