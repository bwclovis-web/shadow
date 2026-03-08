import { getRateLimitStats } from "@/utils/security/rate-limit-monitor.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

const RateLimitStatsPage = async () => {
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
