import { getAuditStats } from "@/utils/security/audit-logger.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

const AuditStatsPage = async () => {
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
