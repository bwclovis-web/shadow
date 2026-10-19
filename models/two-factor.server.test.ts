import { describe, expect, it, vi } from "vitest"
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
  replaceTwoFactorSecret,
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
    it("strips spaces and hyphens", () => {
      expect(normalizeTotpCode("123 456")).toBe("123456")
      expect(normalizeTotpCode("123-456")).toBe("123456")
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

  describe("replaceTwoFactorSecret", () => {
    it("stores the new secret when the scanned code matches", async () => {
      const secret = generateSecret()
      const token = generateSync({ secret })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-1",
        twoFactorEnabledAt: new Date(),
        totpSecretEncrypted: "enc:old-secret",
      } as never)
      vi.mocked(prisma.user.update).mockResolvedValue({} as never)

      const result = await replaceTwoFactorSecret("user-1", secret, token)

      expect(result).toEqual({ success: true })
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { totpSecretEncrypted: `enc:${secret}` },
      })
    })

    it("does not replace the secret when the code is wrong", async () => {
      vi.mocked(prisma.user.update).mockClear()
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-1",
        twoFactorEnabledAt: new Date(),
        totpSecretEncrypted: "enc:old-secret",
      } as never)

      const result = await replaceTwoFactorSecret("user-1", generateSecret(), "000000")

      expect(result.success).toBe(false)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })
  })
})
