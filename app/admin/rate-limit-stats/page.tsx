import type { Metadata } from "next"

import { getRateLimitStats } from "@/utils/security/rate-limit-monitor.server"

import { StatsJsonPage } from "../components/StatsJsonPage"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Rate limit stats - Admin - Shadow and Sillage",
    description: "JSON snapshot of rate limiting statistics for administrators.",
  }
}

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
