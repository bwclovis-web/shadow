import { randomBytes } from "crypto"

import bcrypt from "bcryptjs"
import { generateSecret, generateURI, verify } from "otplib"

import { prisma } from "@/lib/db"
import { invalidateAllSessions } from "@/models/session.server"
import { decryptField, encryptField } from "@/utils/security/field-encryption.server"
import { verifyPassword } from "@/utils/security/password-security.server"
import { logTwoFactorAudit } from "@/utils/security/two-factor-audit.server"

const APP_NAME = "Shadows"
const BACKUP_CODE_COUNT = 10
/** ±30s (one TOTP period) for clock skew */
const TOTP_EPOCH_TOLERANCE = 30

export type TwoFactorUserSnapshot = {
  id: string
  email: string
  twoFactorEnabledAt: Date | null
  totpSecretEncrypted: string | null
}

export const isTwoFactorEnabled = (user: {
  twoFactorEnabledAt: Date | null
  totpSecretEncrypted: string | null
}): boolean =>
  user.twoFactorEnabledAt != null && user.totpSecretEncrypted != null

export const normalizeTotpCode = (code: string): string =>
  code.replace(/\s/g, "").trim()

export const normalizeBackupCode = (code: string): string =>
  code.replace(/[\s-]/g, "").trim().toUpperCase()

const generateBackupCodePlaintext = (): string => {
  const segment = () => randomBytes(2).toString("hex").toUpperCase()
  return `${segment()}-${segment()}-${segment()}`
}

const hashBackupCode = async (code: string): Promise<string> =>
  bcrypt.hash(normalizeBackupCode(code), 10)

export const getTwoFactorStatus = async (
  userId: string
): Promise<TwoFactorUserSnapshot | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      twoFactorEnabledAt: true,
      totpSecretEncrypted: true,
    },
  })
  return user
}

export const startTwoFactorEnrollment = async (
  userId: string
): Promise<{ secret: string; otpauthUri: string } | { error: string }> => {
  const user = await getTwoFactorStatus(userId)
  if (!user) {
    return { error: "User not found" }
  }
  if (isTwoFactorEnabled(user)) {
    return { error: "Two-factor authentication is already enabled" }
  }

  const secret = generateSecret()
  const otpauthUri = generateURI({
    issuer: APP_NAME,
    label: user.email,
    secret,
  })

  return { secret, otpauthUri }
}

const getDecryptedTotpSecret = (totpSecretEncrypted: string): string =>
  decryptField(totpSecretEncrypted)

export const verifyTotpForUser = async (
  userId: string,
  code: string
): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecretEncrypted: true, twoFactorEnabledAt: true },
  })
  if (!user?.totpSecretEncrypted || !user.twoFactorEnabledAt) {
    return false
  }
  const secret = getDecryptedTotpSecret(user.totpSecretEncrypted)
  const normalized = normalizeTotpCode(code)
  if (!/^\d{6}$/.test(normalized)) {
    return false
  }
  const result = await verify({
    secret,
    token: normalized,
    epochTolerance: TOTP_EPOCH_TOLERANCE,
  })
  return result.valid === true
}

export const verifyTotpWithSecret = async (
  secret: string,
  code: string
): Promise<boolean> => {
  const normalized = normalizeTotpCode(code)
  if (!/^\d{6}$/.test(normalized)) {
    return false
  }
  const result = await verify({
    secret,
    token: normalized,
    epochTolerance: TOTP_EPOCH_TOLERANCE,
  })
  return result.valid === true
}

export const confirmTwoFactorEnrollment = async (
  userId: string,
  secret: string,
  code: string,
  password: string
): Promise<{ success: true; backupCodes: string[] } | { success: false; error: string }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      twoFactorEnabledAt: true,
      totpSecretEncrypted: true,
    },
  })
  if (!user) {
    return { success: false, error: "User not found" }
  }
  if (isTwoFactorEnabled(user)) {
    return { success: false, error: "Two-factor authentication is already enabled" }
  }

  const passwordValid = await verifyPassword(password, user.password)
  if (!passwordValid) {
    return { success: false, error: "Current password is incorrect" }
  }

  const codeValid = await verifyTotpWithSecret(secret, code)
  if (!codeValid) {
    return { success: false, error: "Invalid verification code" }
  }

  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    generateBackupCodePlaintext()
  )
  const encryptedSecret = encryptField(secret)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        totpSecretEncrypted: encryptedSecret,
        twoFactorEnabledAt: new Date(),
      },
    })
    await tx.userTwoFactorBackupCode.deleteMany({ where: { userId } })
    for (const plain of backupCodes) {
      await tx.userTwoFactorBackupCode.create({
        data: {
          userId,
          codeHash: await hashBackupCode(plain),
        },
      })
    }
  })

  await logTwoFactorAudit({
    userId,
    action: "DATA_MODIFICATION",
    severity: "info",
    resourceId: userId,
    details: { action: "two_factor_enabled" },
  })

  return { success: true, backupCodes }
}

export const consumeBackupCode = async (
  userId: string,
  code: string
): Promise<boolean> => {
  const normalized = normalizeBackupCode(code)
  if (normalized.length < 8) {
    return false
  }

  const rows = await prisma.userTwoFactorBackupCode.findMany({
    where: { userId, usedAt: null },
  })

  for (const row of rows) {
    const match = await bcrypt.compare(normalized, row.codeHash)
    if (match) {
      await prisma.userTwoFactorBackupCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      })
      await logTwoFactorAudit({
        userId,
        action: "LOGIN_SUCCESS",
        severity: "warning",
        resourceId: userId,
        details: { action: "backup_code_used", backupCodeId: row.id },
      })
      return true
    }
  }
  return false
}

export const verifyTwoFactorAtSignIn = async (
  userId: string,
  code: string,
  useBackupCode: boolean
): Promise<boolean> => {
  if (useBackupCode) {
    return consumeBackupCode(userId, code)
  }
  return verifyTotpForUser(userId, code)
}

export const disableTwoFactor = async (
  userId: string,
  password: string,
  code: string,
  useBackupCode: boolean
): Promise<
  { success: true; message: string } | { success: false; error: string }
> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      twoFactorEnabledAt: true,
      totpSecretEncrypted: true,
    },
  })
  if (!user) {
    return { success: false, error: "User not found" }
  }
  if (!isTwoFactorEnabled(user)) {
    return { success: false, error: "Two-factor authentication is not enabled" }
  }

  const passwordValid = await verifyPassword(password, user.password)
  if (!passwordValid) {
    return { success: false, error: "Current password is incorrect" }
  }

  const codeValid = useBackupCode
    ? await consumeBackupCode(userId, code)
    : await verifyTotpForUser(userId, code)
  if (!codeValid) {
    return { success: false, error: "Invalid verification code" }
  }

  await clearTwoFactorForUser(userId)
  await invalidateAllSessions(userId)

  await logTwoFactorAudit({
    userId,
    action: "DATA_MODIFICATION",
    severity: "warning",
    resourceId: userId,
    details: { action: "two_factor_disabled" },
  })

  return {
    success: true,
    message: "Two-factor authentication has been disabled.",
  }
}

export const regenerateBackupCodes = async (
  userId: string,
  password: string,
  totpCode: string
): Promise<
  { success: true; backupCodes: string[] } | { success: false; error: string }
> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      twoFactorEnabledAt: true,
      totpSecretEncrypted: true,
    },
  })
  if (!user || !isTwoFactorEnabled(user)) {
    return { success: false, error: "Two-factor authentication is not enabled" }
  }

  const passwordValid = await verifyPassword(password, user.password)
  if (!passwordValid) {
    return { success: false, error: "Current password is incorrect" }
  }

  const codeValid = await verifyTotpForUser(userId, totpCode)
  if (!codeValid) {
    return { success: false, error: "Invalid verification code" }
  }

  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    generateBackupCodePlaintext()
  )

  await prisma.$transaction(async (tx) => {
    await tx.userTwoFactorBackupCode.deleteMany({ where: { userId } })
    for (const plain of backupCodes) {
      await tx.userTwoFactorBackupCode.create({
        data: {
          userId,
          codeHash: await hashBackupCode(plain),
        },
      })
    }
    await tx.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    })
  })

  await invalidateAllSessions(userId)

  await logTwoFactorAudit({
    userId,
    action: "DATA_MODIFICATION",
    severity: "info",
    resourceId: userId,
    details: { action: "backup_codes_regenerated" },
  })

  return { success: true, backupCodes }
}

export const clearTwoFactorForUser = async (userId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.userTwoFactorBackupCode.deleteMany({ where: { userId } })
    await tx.user.update({
      where: { id: userId },
      data: {
        totpSecretEncrypted: null,
        twoFactorEnabledAt: null,
        tokenVersion: { increment: 1 },
      },
    })
  })
}

export const adminResetTwoFactor = async (
  targetUserId: string,
  adminId: string
): Promise<
  { success: true; message: string } | { success: false; error: string }
> => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, twoFactorEnabledAt: true, totpSecretEncrypted: true },
  })
  if (!user) {
    return { success: false, error: "User not found" }
  }
  if (!isTwoFactorEnabled(user)) {
    return { success: false, error: "Two-factor authentication is not enabled for this user" }
  }

  await clearTwoFactorForUser(targetUserId)
  await invalidateAllSessions(targetUserId)

  await logTwoFactorAudit({
    userId: adminId,
    action: "DATA_MODIFICATION",
    severity: "warning",
    resourceId: targetUserId,
    details: { action: "admin_reset_2fa", targetUserId },
  })

  return {
    success: true,
    message: "Two-factor authentication has been reset for this user.",
  }
}
