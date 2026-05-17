/**
 * Rate limits for trade API routes (server-only).
 *
 * Environment variables:
 * - TRADE_CREATE_RATE_LIMIT_PER_HOUR
 * - TRADE_CREATE_RATE_LIMIT_PER_DAY_PER_PAIR
 */

import type { RateLimitConfig } from "@/utils/rate-limit-config.server"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const parseIntEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === "") return fallback
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

export interface TradeCreateRateLimits {
  perUser: RateLimitConfig
  perPair: RateLimitConfig
}

let tradeCreateLimitsCache: TradeCreateRateLimits | null = null

export const getTradeCreateRateLimits = (): TradeCreateRateLimits => {
  if (tradeCreateLimitsCache) return tradeCreateLimitsCache
  tradeCreateLimitsCache = {
    perUser: {
      max: parseIntEnv(process.env.TRADE_CREATE_RATE_LIMIT_PER_HOUR, 20),
      windowMs: HOUR_MS,
    },
    perPair: {
      max: parseIntEnv(process.env.TRADE_CREATE_RATE_LIMIT_PER_DAY_PER_PAIR, 10),
      windowMs: DAY_MS,
    },
  }
  return tradeCreateLimitsCache
}
