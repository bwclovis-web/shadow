/**
 * Rate limit configuration for the Next.js app (server-only).
 *
 * Environment variables:
 * - Contact messages: CONTACT_MESSAGE_RATE_LIMIT_PER_HOUR, CONTACT_MESSAGE_RATE_LIMIT_PER_DAY_PER_PAIR
 * - Signup: SIGNUP_RATE_LIMIT_MAX, SIGNUP_RATE_LIMIT_WINDOW_MINUTES
 * - Subscribe: SUBSCRIBE_RATE_LIMIT_MAX, SUBSCRIBE_RATE_LIMIT_WINDOW_MINUTES
 */

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const parseIntEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === "") return fallback
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

export interface RateLimitConfig {
  max: number
  windowMs: number
}

export interface ContactMessageRateLimits {
  perUser: RateLimitConfig
  perPair: RateLimitConfig
}

export interface RateLimitMessages {
  perUser: string
  perPair: string
}

export interface SignupSubscribeRateLimits {
  signup: RateLimitConfig
  subscribe: RateLimitConfig
}

let contactMessageLimitsCache: ContactMessageRateLimits | null = null

export const getContactMessageRateLimits = (): ContactMessageRateLimits => {
  if (contactMessageLimitsCache) return contactMessageLimitsCache
  contactMessageLimitsCache = {
    perUser: {
      max: parseIntEnv(process.env.CONTACT_MESSAGE_RATE_LIMIT_PER_HOUR, 10),
      windowMs: HOUR_MS,
    },
    perPair: {
      max: parseIntEnv(
        process.env.CONTACT_MESSAGE_RATE_LIMIT_PER_DAY_PER_PAIR,
        3
      ),
      windowMs: DAY_MS,
    },
  }
  return contactMessageLimitsCache
}

export const getRateLimitMessages = (): RateLimitMessages => {
  const limits = getContactMessageRateLimits()
  const s = (n: number) => (n !== 1 ? "s" : "")
  return {
    perUser: `You can send up to ${limits.perUser.max} message${s(limits.perUser.max)} per hour`,
    perPair: `You can send up to ${limits.perPair.max} message${s(limits.perPair.max)} per day to this trader`,
  }
}

let signupSubscribeLimitsCache: SignupSubscribeRateLimits | null = null

export const getSignupSubscribeRateLimits = (): SignupSubscribeRateLimits => {
  if (signupSubscribeLimitsCache) return signupSubscribeLimitsCache
  signupSubscribeLimitsCache = {
    signup: {
      max: parseIntEnv(process.env.SIGNUP_RATE_LIMIT_MAX, 5),
      windowMs:
        parseIntEnv(process.env.SIGNUP_RATE_LIMIT_WINDOW_MINUTES, 15) *
        60 *
        1000,
    },
    subscribe: {
      max: parseIntEnv(process.env.SUBSCRIBE_RATE_LIMIT_MAX, 10),
      windowMs:
        parseIntEnv(process.env.SUBSCRIBE_RATE_LIMIT_WINDOW_MINUTES, 15) *
        60 *
        1000,
    },
  }
  return signupSubscribeLimitsCache
}
