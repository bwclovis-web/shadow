import { getAuditStats } from "@/utils/security/audit-logger.server"
import { requireAdminSession } from "@/utils/requireAdmin.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

export const ROUTE_PATH = "/admin/audit-stats" as const

const AuditStatsPage = async () => {
  await requireAdminSession(ROUTE_PATH)
  const stats = getAuditStats()
  const timestamp = new Date().toISOString()

  return (
    <StatsJsonPage
      title="Audit stats"
      stats={stats}
      timestamp={timestamp}
    />
  )
}

export default AuditStatsPage
