import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { getUserByIdMock, getUserTokenVersionMock } = vi.hoisted(() => ({
  getUserByIdMock: vi.fn(),
  getUserTokenVersionMock: vi.fn(),
}))

vi.mock("@/models/user.query", () => ({
  getUserById: (...args: unknown[]) => getUserByIdMock(...args),
  getUserTokenVersion: (...args: unknown[]) => getUserTokenVersionMock(...args),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { update: vi.fn() },
    refreshSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  }
})

const TEST_JWT_SECRET = "test-secret-at-least-32-characters-long!!"

const baseUser = {
  id: "user-1",
  email: "a@b.com",
  password: "hash",
  firstName: "Ada",
  lastName: "Lovelace",
  username: "ada",
  profileSlug: "ada",
  traderAbout: null,
  avatarImage: null,
  region: null,
  instagramHandle: null,
  fragranticaUrl: null,
  redditUsername: null,
  strikeCount: 0,
  isBanned: false,
  role: "user" as const,
  tokenVersion: 2,
  subscriptionStatus: "paid" as const,
  membershipTier: "premium" as const,
  isEarlyAdopter: false,
  lastActiveAt: null,
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
}

let createAccessToken: (userId: string, tokenVersion: number) => string
let getSessionFromCookieHeader: typeof import("./session-from-request.server").getSessionFromCookieHeader

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", TEST_JWT_SECRET)
  const sessionMod = await import("./security/session-manager.server")
  createAccessToken = sessionMod.createAccessToken
  ;({ getSessionFromCookieHeader } = await import("./session-from-request.server"))
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe("getSessionFromCookieHeader includeUser", () => {
  beforeEach(() => {
    getUserByIdMock.mockReset()
    getUserTokenVersionMock.mockReset()
  })

  it("loads the user once and skips getUserTokenVersion", async () => {
    const token = createAccessToken("user-1", 2)
    getUserByIdMock.mockResolvedValue({ ...baseUser })

    const session = await getSessionFromCookieHeader(`accessToken=${token}`, {
      includeUser: true,
    })

    expect(session?.userId).toBe("user-1")
    expect(session?.user?.email).toBe("a@b.com")
    expect(getUserByIdMock).toHaveBeenCalledTimes(1)
    expect(getUserTokenVersionMock).not.toHaveBeenCalled()
  })

  it("returns null when JWT tokenVersion is stale vs user row", async () => {
    const token = createAccessToken("user-1", 1)
    getUserByIdMock.mockResolvedValue({ ...baseUser, tokenVersion: 3 })

    const session = await getSessionFromCookieHeader(`accessToken=${token}`, {
      includeUser: true,
    })

    expect(session).toBeNull()
    expect(getUserByIdMock).toHaveBeenCalledTimes(1)
    expect(getUserTokenVersionMock).not.toHaveBeenCalled()
  })

  it("returns null when user is banned", async () => {
    const token = createAccessToken("user-1", 2)
    getUserByIdMock.mockResolvedValue({ ...baseUser, isBanned: true })

    const session = await getSessionFromCookieHeader(`accessToken=${token}`, {
      includeUser: true,
    })

    expect(session).toBeNull()
  })

  it("still uses getUserTokenVersion when includeUser is false", async () => {
    const token = createAccessToken("user-1", 2)
    getUserTokenVersionMock.mockResolvedValue(2)

    const session = await getSessionFromCookieHeader(`accessToken=${token}`, {
      includeUser: false,
    })

    expect(session).toEqual({ userId: "user-1" })
    expect(getUserByIdMock).not.toHaveBeenCalled()
    expect(getUserTokenVersionMock).toHaveBeenCalledWith("user-1")
  })
})
