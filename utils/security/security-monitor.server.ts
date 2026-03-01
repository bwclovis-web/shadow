import type { SecurityStats } from "@/app/admin/types/security-stats"
import { defaultSecurityStats } from "@/app/admin/types/security-stats"

/**
 * Returns current security event statistics.
 * Replace with real implementation (e.g. in-memory store or DB aggregation).
 */
export const getSecurityStats = (): SecurityStats => ({ ...defaultSecurityStats })
