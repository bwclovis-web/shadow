import { randomUUID } from "node:crypto"

import { prisma } from "@/lib/db"
import { createJsonResponse } from "@/utils/response.server"

/** In-process fallback when the DB is unavailable (local/dev). */
const memoryBuckets = new Map<string, { count: number; resetAt: number }>()

/** In-process violation counters for admin monitor. */
const violationStats = {
  totalViolations: 0,
  byKeyPrefix: new Map<string, number>(),
  lastViolationAt: null as string | null,
}

export const getInMemoryRateLimitViolationStats = () => ({
  totalViolations: violationStats.totalViolations,
  byKeyPrefix: Object.fromEntries(violationStats.byKeyPrefix),
  lastViolationAt: violationStats.lastViolationAt,
})

const recordViolation = (identifier: string) => {
  violationStats.totalViolations += 1
  violationStats.lastViolationAt = new Date().toISOString()
  const prefix = identifier.split(":")[0] ?? "unknown"
  violationStats.byKeyPrefix.set(
    prefix,
    (violationStats.byKeyPrefix.get(prefix) ?? 0) + 1
  )
}

const throwRateLimited = (resetAtMs: number): never => {
  const retryAfter = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000))
  throw createJsonResponse(
    {
      success: false,
      error: "Rate limit exceeded",
      retryAfter,
    },
    429,
    { "Retry-After": String(retryAfter) }
  )
}

const enforceMemory = (
  identifier: string,
  maxRequests: number,
  windowMs: number
): void => {
  const now = Date.now()
  const current = memoryBuckets.get(identifier)
  if (!current || now > current.resetAt) {
    memoryBuckets.set(identifier, { count: 1, resetAt: now + windowMs })
    return
  }
  if (current.count >= maxRequests) {
    recordViolation(identifier)
    throwRateLimited(current.resetAt)
  }
  current.count += 1
}

/**
 * Durable rate limit using Postgres RateLimitBucket, with in-memory fallback.
 * Call sites must await this (throws a JSON Response on limit exceeded).
 */
export const enforceDurableRateLimit = async (
  identifier: string,
  maxRequests = 100,
  windowMs = 15 * 60 * 1000
): Promise<void> => {
  const now = new Date()
  try {
    // One PostgreSQL statement serializes concurrent requests on the unique key.
    // Keep rejected counts bounded and preserve the original window until expiry.
    const [existing] = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitBucket" ("id", "key", "count", "resetAt", "updatedAt", "createdAt")
      VALUES (${randomUUID()}, ${identifier}, 1, ${new Date(now.getTime() + windowMs)}, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
          ELSE LEAST("RateLimitBucket"."count", ${maxRequests}) + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN EXCLUDED."resetAt"
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "resetAt"
    `
    if (!existing) throw new Error("Rate limit bucket was not returned")

    if (existing.count > maxRequests) {
      recordViolation(identifier)
      try {
        const { logSecurityAudit } = await import(
          "@/utils/security/security-audit.server"
        )
        await logSecurityAudit({
          userId: null,
          action: "RATE_LIMIT_EXCEEDED",
          severity: "warning",
          resource: "RateLimit",
          resourceId: identifier,
          details: { maxRequests, windowMs, count: existing.count },
        })
      } catch {
        /* ignore audit failures */
      }
      throwRateLimited(existing.resetAt.getTime())
    }

  } catch (error) {
    if (error instanceof Response) throw error
    // DB unavailable — fall back to process memory so auth still has protection.
    enforceMemory(identifier, maxRequests, windowMs)
  }
}
