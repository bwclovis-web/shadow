import type { Metadata } from "next"

import { getRateLimitStats } from "@/utils/security/rate-limit-monitor.server"

import { StatsJsonPage } from "../components/StatsJsonPage"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Rate limit stats — Admin",
    description: "JSON snapshot of rate limiting statistics for administrators.",
  }
}

const RateLimitStatsPage = async () => {
  const stats = getRateLimitStats()
  const timestamp = new Date().toISOString()
  return (
    <main id="main-content">
      <PageWrapper>
        <StatsJsonPage
          title="Rate limit stats"
          stats={stats}
          timestamp={timestamp}
        />
      </PageWrapper>
    </main>
  )
}

export default RateLimitStatsPage
