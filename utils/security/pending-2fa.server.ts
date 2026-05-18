import jwt from "jsonwebtoken"

import { getAuthCookieFlags } from "@/utils/security/auth-cookie.server"

const PENDING_2FA_COOKIE = "pending2fa"
const PENDING_2FA_SETUP_COOKIE = "pending2faSetup"
const PENDING_TTL_SECONDS = 5 * 60
const SETUP_TTL_SECONDS = 10 * 60

type Pending2faPayload = {
  userId: string
  type: "pending2fa"
}

type Pending2faSetupPayload = {
  userId: string
  type: "pending2faSetup"
  secret: string
}

const getJwtSecret = (): string => {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET environment variable is required (min 32 chars)")
  }
  return jwtSecret
}

const signToken = (payload: Record<string, unknown>, expiresIn: number): string =>
  jwt.sign(payload, getJwtSecret(), { expiresIn })

export const createPending2faToken = (userId: string): string =>
  signToken({ userId, type: "pending2fa" satisfies Pending2faPayload["type"] }, PENDING_TTL_SECONDS)

export const createPending2faSetupToken = (userId: string, secret: string): string =>
  signToken(
    {
      userId,
      type: "pending2faSetup" satisfies Pending2faSetupPayload["type"],
      secret,
    },
    SETUP_TTL_SECONDS
  )

export const verifyPending2faToken = (token: string): { userId: string } | null => {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as Pending2faPayload
    if (payload.type !== "pending2fa" || !payload.userId) {
      return null
    }
    return { userId: payload.userId }
  } catch {
    return null
  }
}

export const verifyPending2faSetupToken = (
  token: string
): { userId: string; secret: string } | null => {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as Pending2faSetupPayload
    if (payload.type !== "pending2faSetup" || !payload.userId || !payload.secret) {
      return null
    }
    return { userId: payload.userId, secret: payload.secret }
  } catch {
    return null
  }
}

export const getPending2faCookieName = (): string => PENDING_2FA_COOKIE
export const getPending2faSetupCookieName = (): string => PENDING_2FA_SETUP_COOKIE

export const getPending2faCookieOptions = () => {
  const flags = getAuthCookieFlags()
  return {
    ...flags,
    maxAge: PENDING_TTL_SECONDS,
  }
}

export const getPending2faSetupCookieOptions = () => {
  const flags = getAuthCookieFlags()
  return {
    ...flags,
    maxAge: SETUP_TTL_SECONDS,
  }
}
