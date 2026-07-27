import type { Metadata } from "next"

import { getSecurityStats } from "@/utils/security/security-monitor.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Security stats — Admin",
    description: "JSON snapshot of security monitor statistics for administrators.",
  }
}

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
