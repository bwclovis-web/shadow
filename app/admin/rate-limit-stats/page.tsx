import { getRateLimitStats } from "@/utils/security/rate-limit-monitor.server"
import { requireAdminSession } from "@/utils/requireAdmin.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

export const ROUTE_PATH = "/admin/rate-limit-stats" as const

const RateLimitStatsPage = async () => {
  await requireAdminSession(ROUTE_PATH)
  const stats = getRateLimitStats()
  const timestamp = new Date().toISOString()

  return (
    <StatsJsonPage
      title="Rate limit stats"
      stats={stats}
      timestamp={timestamp}
    />
  )
}

export default RateLimitStatsPage
