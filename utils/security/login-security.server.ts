import crypto from "crypto"
import { cookies } from "next/headers"

import { prisma } from "@/lib/db"
import {
  createUserAlert,
  getUserAlertPreferences,
} from "@/models/user-alerts.server"
import { getUserById } from "@/models/user.query"
import {
  checkAccountLockout,
  PASSWORD_CONFIG,
} from "@/utils/security/password-security.server"
import { logSecurityAudit } from "@/utils/security/security-audit.server"
import { sendSecurityAlertEmail } from "@/utils/alert-email.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"

const LOGIN_HISTORY_DAYS = 90
const MIN_PRIOR_LOGINS_FOR_DEVICE_ALERT = 3
const ALERT_DEDUPE_MS = 24 * 60 * 60 * 1000
const TRUSTED_DEVICE_COOKIE = "shadow_trusted_device"
const TRUSTED_DEVICE_MAX_AGE_SEC = 60 * 60 * 24 * 60

export type SuspiciousLoginReason =
  | "login_failures"
  | "new_device"
  | "new_region"
  | "new_device_and_region"

export type LoginContext = {
  deviceFingerprint: string
  countryCode: string | null
  ipHash: string
  userAgent: string | null
  trustedDeviceToken: string | null
}

export const isLoginHeuristicsEnabled = (): boolean =>
  process.env.LOGIN_HEURISTICS_ENABLED === "true"

const getIpHashPepper = (): string => {
  const pepper = process.env.LOGIN_IP_HASH_PEPPER?.trim()
  if (pepper && pepper.length >= 16) return pepper
  if (process.env.NODE_ENV === "production") {
    throw new Error("LOGIN_IP_HASH_PEPPER must be set in production")
  }
  return "dev-login-ip-pepper-not-for-production"
}

export const hashLoginIp = (ip: string): string =>
  crypto.createHash("sha256").update(`${getIpHashPepper()}:${ip}`).digest("hex")

const normalizeUserAgent = (userAgent: string | null): string =>
  (userAgent ?? "unknown").trim().slice(0, 512)

export const buildDeviceFingerprint = (userAgent: string | null): string =>
  crypto
    .createHash("sha256")
    .update(normalizeUserAgent(userAgent))
    .digest("hex")
    .slice(0, 32)

const readCountryCode = (headers: Headers): string | null => {
  const raw =
    headers.get("x-vercel-ip-country")?.trim() ||
    headers.get("cf-ipcountry")?.trim() ||
    null
  if (!raw || raw === "XX" || raw.toLowerCase() === "unknown") return null
  return raw.toUpperCase()
}

export const getLoginContext = async (headers: Headers): Promise<LoginContext> => {
  const clientIp = getClientIdentifierFromHeaders(headers)
  const userAgent = headers.get("user-agent")
  const cookieStore = await cookies()
  const trustedDeviceToken =
    cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value?.trim() || null

  return {
    deviceFingerprint: buildDeviceFingerprint(userAgent),
    countryCode: readCountryCode(headers),
    ipHash: hashLoginIp(clientIp),
    userAgent: userAgent ? normalizeUserAgent(userAgent) : null,
    trustedDeviceToken,
  }
}

export type AccountLockoutState = {
  isLocked: boolean
  attemptsRemaining: number
  lockoutExpiresAt?: Date
}

export const getAccountLockoutState = async (
  userId: string
): Promise<AccountLockoutState> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, lastFailedLoginAt: true },
  })
  if (!user) {
    return { isLocked: false, attemptsRemaining: PASSWORD_CONFIG.MAX_LOGIN_ATTEMPTS }
  }
  return checkAccountLockout(user.failedLoginAttempts, user.lastFailedLoginAt ?? undefined)
}

export const assertAccountNotLocked = async (userId: string): Promise<void> => {
  const state = await getAccountLockoutState(userId)
  if (!state.isLocked) return
  const minutes = Math.ceil(PASSWORD_CONFIG.LOCKOUT_DURATION / 60000)
  throw new Error(
    `Too many failed sign-in attempts. Try again in about ${minutes} minutes.`
  )
}

const historySince = (): Date => {
  const d = new Date()
  d.setDate(d.getDate() - LOGIN_HISTORY_DAYS)
  return d
}

const isTrustedDevice = async (
  userId: string,
  ctx: LoginContext
): Promise<boolean> => {
  if (!ctx.trustedDeviceToken) return false
  const match = await prisma.userLoginEvent.findFirst({
    where: {
      userId,
      success: true,
      deviceFingerprint: ctx.deviceFingerprint,
      createdAt: { gte: historySince() },
    },
    select: { id: true },
  })
  return Boolean(match)
}

export const evaluateSuspiciousLogin = async (
  userId: string,
  ctx: LoginContext
): Promise<{ suspicious: boolean; reasons: SuspiciousLoginReason[] }> => {
  if (!isLoginHeuristicsEnabled()) {
    return { suspicious: false, reasons: [] }
  }

  if (await isTrustedDevice(userId, ctx)) {
    return { suspicious: false, reasons: [] }
  }

  const successes = await prisma.userLoginEvent.findMany({
    where: { userId, success: true, createdAt: { gte: historySince() } },
    select: { deviceFingerprint: true, countryCode: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  if (successes.length === 0) {
    return { suspicious: false, reasons: [] }
  }

  const knownDevices = new Set(successes.map(s => s.deviceFingerprint))
  const knownCountries = new Set(
    successes.map(s => s.countryCode).filter((c): c is string => Boolean(c))
  )

  const isNewDevice = !knownDevices.has(ctx.deviceFingerprint)
  const isNewRegion =
    ctx.countryCode != null &&
    knownCountries.size > 0 &&
    !knownCountries.has(ctx.countryCode)

  const reasons: SuspiciousLoginReason[] = []

  if (isNewDevice && isNewRegion) {
    reasons.push("new_device_and_region")
  } else if (
    isNewDevice &&
    successes.length >= MIN_PRIOR_LOGINS_FOR_DEVICE_ALERT
  ) {
    reasons.push("new_device")
  }

  return { suspicious: reasons.length > 0, reasons }
}

const hasRecentAlert = async (
  userId: string,
  reason: SuspiciousLoginReason
): Promise<boolean> => {
  const since = new Date(Date.now() - ALERT_DEDUPE_MS)
  const existing = await prisma.userAlert.findFirst({
    where: {
      userId,
      alertType: "suspicious_login",
      createdAt: { gte: since },
      metadata: { path: ["reason"], equals: reason },
    },
    select: { id: true },
  })
  return Boolean(existing)
}

const alertCopyForReason = (
  reason: SuspiciousLoginReason
): { title: string; message: string } => {
  switch (reason) {
    case "login_failures":
      return {
        title: "Repeated failed sign-in attempts",
        message:
          "Several failed sign-in attempts were detected on your account. If this wasn't you, change your password and enable two-factor authentication in Security settings.",
      }
    case "new_device_and_region":
      return {
        title: "Sign-in from a new device and region",
        message:
          "Your account was signed in from a device and region we haven't seen before. If this wasn't you, change your password and enable two-factor authentication.",
      }
    case "new_device":
      return {
        title: "Sign-in from a new device",
        message:
          "Your account was signed in from a device we haven't seen before. If this wasn't you, review your Security settings and change your password.",
      }
    case "new_region":
      return {
        title: "Sign-in from a new region",
        message:
          "Your account was signed in from a region we haven't seen before. If this wasn't you, change your password and enable two-factor authentication.",
      }
    default:
      return {
        title: "Unusual sign-in activity",
        message:
          "We detected unusual sign-in activity on your account. Review your Security settings if this wasn't you.",
      }
  }
}

export const dispatchSuspiciousLoginAlerts = async (
  userId: string,
  reasons: SuspiciousLoginReason[]
): Promise<void> => {
  if (!isLoginHeuristicsEnabled() || reasons.length === 0) return

  const user = await getUserById(userId)
  if (!user) return

  const preferences = await getUserAlertPreferences(userId)

  for (const reason of reasons) {
    if (await hasRecentAlert(userId, reason)) continue

    const { title, message } = alertCopyForReason(reason)
    const metadata = { reason, countryCode: null as string | null }

    await logSecurityAudit({
      userId,
      action: "SUSPICIOUS_ACTIVITY",
      severity: "warning",
      resourceId: userId,
      details: { reason, heuristic: "suspicious_login" },
    })

    const alert = await createUserAlert(
      userId,
      null,
      "suspicious_login",
      title,
      message,
      metadata,
      preferences
    )

    if (alert) {
      await sendSecurityAlertEmail({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          profileSlug: user.profileSlug,
        },
        preferences,
        title,
        message,
      })
    }
  }
}

const incrementFailedAttempts = async (userId: string): Promise<number> => {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: { increment: 1 },
      lastFailedLoginAt: new Date(),
    },
    select: { failedLoginAttempts: true },
  })
  return updated.failedLoginAttempts
}

const resetFailedAttempts = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lastFailedLoginAt: null },
  })
}

export const establishTrustedDeviceCookie = async (
  deviceFingerprint: string
): Promise<void> => {
  const cookieStore = await cookies()
  const token = crypto
    .createHash("sha256")
    .update(`${getIpHashPepper()}:device:${deviceFingerprint}`)
    .digest("hex")
    .slice(0, 48)

  cookieStore.set(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TRUSTED_DEVICE_MAX_AGE_SEC,
  })
}

export const recordLoginAttempt = async (params: {
  userId: string
  success: boolean
  ctx: LoginContext
  failureReason?: string
  skipHeuristics?: boolean
}): Promise<void> => {
  if (!isLoginHeuristicsEnabled()) return

  const { userId, success, ctx, failureReason, skipHeuristics } = params

  let suspiciousReasons: SuspiciousLoginReason[] = []
  if (success && !skipHeuristics) {
    const evaluation = await evaluateSuspiciousLogin(userId, ctx)
    suspiciousReasons = evaluation.reasons
  }

  await prisma.userLoginEvent.create({
    data: {
      userId,
      success,
      failureReason: failureReason ?? null,
      deviceFingerprint: ctx.deviceFingerprint,
      countryCode: ctx.countryCode,
      ipHash: ctx.ipHash,
      userAgent: ctx.userAgent,
    },
  })

  await logSecurityAudit({
    userId,
    action: success ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
    severity: success ? "info" : "warning",
    resourceId: userId,
    ipAddress: ctx.ipHash,
    userAgent: ctx.userAgent,
    details: {
      countryCode: ctx.countryCode,
      ...(failureReason ? { failureReason } : {}),
    },
  })

  if (!success) {
    const attempts = await incrementFailedAttempts(userId)
    if (attempts >= PASSWORD_CONFIG.MAX_LOGIN_ATTEMPTS) {
      await dispatchSuspiciousLoginAlerts(userId, ["login_failures"])
    }
    return
  }

  await resetFailedAttempts(userId)
  await establishTrustedDeviceCookie(ctx.deviceFingerprint)

  if (suspiciousReasons.length > 0) {
    await dispatchSuspiciousLoginAlerts(userId, suspiciousReasons)
  }
}

export const completeLoginSecurityCheck = async (
  userId: string,
  headers: Headers
): Promise<void> => {
  if (!isLoginHeuristicsEnabled()) return
  const ctx = await getLoginContext(headers)
  await recordLoginAttempt({ userId, success: true, ctx })
}
