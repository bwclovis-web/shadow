import type { RateLimitStats } from "@/app/admin/types/security-stats"
import { defaultRateLimitStats } from "@/app/admin/types/security-stats"

/**
 * Returns current rate limit violation statistics.
 * Replace with real implementation (e.g. in-memory store or Redis).
 */
export const getRateLimitStats = (): RateLimitStats => ({
  ...defaultRateLimitStats,
})
