import { getSecurityStats } from "@/utils/security/security-monitor.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

const SecurityStatsPage = async () => {
  const stats = getSecurityStats()
  const timestamp = new Date().toISOString()

  return (
    <StatsJsonPage
      title="Security stats"
      stats={stats}
      timestamp={timestamp}
    />
  )
}

export default SecurityStatsPage
