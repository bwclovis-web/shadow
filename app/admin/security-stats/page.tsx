import { getSecurityStats } from "@/utils/security/security-monitor.server"
import { requireAdminSession } from "@/utils/requireAdmin.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

export const ROUTE_PATH = "/admin/security-stats" as const

const SecurityStatsPage = async () => {
  await requireAdminSession(ROUTE_PATH)
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
