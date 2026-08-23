import type { RateLimitStats } from "@/app/admin/types/security-stats"
import { defaultRateLimitStats } from "@/app/admin/types/security-stats"
import { getInMemoryRateLimitViolationStats } from "@/utils/security/durable-rate-limit.server"

/**
 * Returns current rate limit violation statistics from the durable limiter.
 */
export const getRateLimitStats = (): RateLimitStats => {
  const stats = getInMemoryRateLimitViolationStats()
  return {
    ...defaultRateLimitStats,
    totalViolations: stats.totalViolations,
    violationsByPath: stats.byKeyPrefix,
  }
}
