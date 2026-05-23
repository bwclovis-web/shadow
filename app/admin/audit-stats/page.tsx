import type { Metadata } from "next"

import { getAuditStats } from "@/utils/security/audit-logger.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Audit stats - Admin - perfumer's hollow",
    description: "JSON snapshot of audit logging statistics for administrators.",
  }
}

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
