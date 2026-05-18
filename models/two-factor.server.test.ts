import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generateSecret, generateSync } from "otplib"

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userTwoFactorBackupCode: {
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<void>) =>
      fn({
        user: { update: vi.fn(), },
        userTwoFactorBackupCode: {
          deleteMany: vi.fn(),
          create: vi.fn(),
        },
      })
    ),
  },
}))

vi.mock("@/utils/security/field-encryption.server", () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: (s: string) => s.replace(/^enc:/, ""),
}))

vi.mock("@/utils/security/two-factor-audit.server", () => ({
  logTwoFactorAudit: vi.fn(),
}))

vi.mock("@/models/session.server", () => ({
  invalidateAllSessions: vi.fn(),
}))

vi.mock("@/utils/security/password-security.server", () => ({
  verifyPassword: vi.fn(),
}))

import { prisma } from "@/lib/db"
import {
  isTwoFactorEnabled,
  normalizeBackupCode,
  normalizeTotpCode,
  verifyTotpWithSecret,
} from "./two-factor.server"

describe("two-factor.server", () => {
  describe("isTwoFactorEnabled", () => {
    it("returns true when both fields are set", () => {
      expect(
        isTwoFactorEnabled({
          twoFactorEnabledAt: new Date(),
          totpSecretEncrypted: "enc:abc",
        })
      ).toBe(true)
    })

    it("returns false when secret is missing", () => {
      expect(
        isTwoFactorEnabled({
          twoFactorEnabledAt: new Date(),
          totpSecretEncrypted: null,
        })
      ).toBe(false)
    })
  })

  describe("normalizeTotpCode", () => {
    it("strips spaces", () => {
      expect(normalizeTotpCode("123 456")).toBe("123456")
    })
  })

  describe("normalizeBackupCode", () => {
    it("uppercases and strips dashes", () => {
      expect(normalizeBackupCode("ab12-cd34")).toBe("AB12CD34")
    })
  })

  describe("verifyTotpWithSecret", () => {
    it("accepts a valid current token", async () => {
      const secret = generateSecret()
      const token = generateSync({ secret })
      const valid = await verifyTotpWithSecret(secret, token)
      expect(valid).toBe(true)
    })

    it("rejects invalid token", async () => {
      const secret = generateSecret()
      const valid = await verifyTotpWithSecret(secret, "000000")
      expect(valid).toBe(false)
    })
  })
})
