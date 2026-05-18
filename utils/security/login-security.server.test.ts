import { beforeEach, describe, expect, it, vi } from "vitest"

const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()
const mockUserFindUnique = vi.fn()
const mockUserUpdate = vi.fn()
const mockLoginEventCreate = vi.fn()
const mockAlertFindFirst = vi.fn()
const mockCreateUserAlert = vi.fn()
const mockGetUserById = vi.fn()
const mockGetUserAlertPreferences = vi.fn()
const mockLogSecurityAudit = vi.fn()
const mockSendSecurityAlertEmail = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    userLoginEvent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockLoginEventCreate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    userAlert: {
      findFirst: (...args: unknown[]) => mockAlertFindFirst(...args),
    },
  },
}))

vi.mock("@/models/user-alerts.server", () => ({
  createUserAlert: (...args: unknown[]) => mockCreateUserAlert(...args),
  getUserAlertPreferences: (...args: unknown[]) => mockGetUserAlertPreferences(...args),
}))

vi.mock("@/models/user.query", () => ({
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
}))

vi.mock("@/utils/security/security-audit.server", () => ({
  logSecurityAudit: (...args: unknown[]) => mockLogSecurityAudit(...args),
}))

vi.mock("@/utils/alert-email.server", () => ({
  sendSecurityAlertEmail: (...args: unknown[]) => mockSendSecurityAlertEmail(...args),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
    set: vi.fn(),
  })),
}))

import {
  buildDeviceFingerprint,
  evaluateSuspiciousLogin,
  hashLoginIp,
  isLoginHeuristicsEnabled,
} from "./login-security.server"

describe("login-security.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.LOGIN_HEURISTICS_ENABLED = "true"
    process.env.LOGIN_IP_HASH_PEPPER = "test-pepper-at-least-16-chars"
  })

  it("is disabled unless LOGIN_HEURISTICS_ENABLED is true", () => {
    process.env.LOGIN_HEURISTICS_ENABLED = "false"
    expect(isLoginHeuristicsEnabled()).toBe(false)
    process.env.LOGIN_HEURISTICS_ENABLED = "true"
    expect(isLoginHeuristicsEnabled()).toBe(true)
  })

  it("hashes IPs deterministically", () => {
    const a = hashLoginIp("203.0.113.1")
    const b = hashLoginIp("203.0.113.1")
    const c = hashLoginIp("203.0.113.2")
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it("builds stable device fingerprints from user agent", () => {
    const fp1 = buildDeviceFingerprint("Mozilla/5.0 Test")
    const fp2 = buildDeviceFingerprint("Mozilla/5.0 Test")
    const fp3 = buildDeviceFingerprint("Other Agent")
    expect(fp1).toBe(fp2)
    expect(fp1).not.toBe(fp3)
  })

  it("returns no reasons on first successful login baseline", async () => {
    mockFindFirst.mockResolvedValue(null)
    mockFindMany.mockResolvedValue([])

    const result = await evaluateSuspiciousLogin("user-1", {
      deviceFingerprint: "device-a",
      countryCode: "US",
      ipHash: "hash",
      userAgent: "Mozilla/5.0",
      trustedDeviceToken: null,
    })

    expect(result.suspicious).toBe(false)
    expect(result.reasons).toEqual([])
  })

  it("flags new device and region when history exists", async () => {
    mockFindFirst.mockResolvedValue(null)
    mockFindMany.mockResolvedValue([
      { deviceFingerprint: "device-old", countryCode: "US" },
      { deviceFingerprint: "device-old", countryCode: "US" },
      { deviceFingerprint: "device-old", countryCode: "US" },
    ])

    const result = await evaluateSuspiciousLogin("user-1", {
      deviceFingerprint: "device-new",
      countryCode: "DE",
      ipHash: "hash",
      userAgent: "Mozilla/5.0",
      trustedDeviceToken: null,
    })

    expect(result.suspicious).toBe(true)
    expect(result.reasons).toContain("new_device_and_region")
  })
})
