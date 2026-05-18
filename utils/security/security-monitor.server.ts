import type { SecurityStats } from "@/app/admin/types/security-stats"
import { defaultSecurityStats } from "@/app/admin/types/security-stats"
import { prisma } from "@/lib/db"

const WINDOW_MS = 24 * 60 * 60 * 1000

export const getSecurityStats = async (): Promise<SecurityStats> => {
  const since = new Date(Date.now() - WINDOW_MS)

  const [logs, suspiciousCount] = await Promise.all([
    prisma.securityAuditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        severity: true,
        ipAddress: true,
        resource: true,
        createdAt: true,
      },
    }),
    prisma.securityAuditLog.count({
      where: {
        createdAt: { gte: since },
        action: "SUSPICIOUS_ACTIVITY",
      },
    }),
  ])

  if (logs.length === 0) {
    return { ...defaultSecurityStats }
  }

  const eventsByType: Record<string, number> = {}
  const eventsBySeverity: Record<string, number> = {}
  const uniqueIpSet = new Set<string>()

  for (const log of logs) {
    eventsByType[log.action] = (eventsByType[log.action] ?? 0) + 1
    eventsBySeverity[log.severity] = (eventsBySeverity[log.severity] ?? 0) + 1
    if (log.ipAddress) uniqueIpSet.add(log.ipAddress)
  }

  const suspiciousIPs = logs.filter(
    l => l.action === "SUSPICIOUS_ACTIVITY" || l.severity === "critical"
  ).length

  const recentEvents = logs.slice(0, 20).map(log => ({
    id: log.id,
    type: log.action,
    ipAddress: log.ipAddress ?? "",
    path: log.resource ?? "",
    timestamp: log.createdAt.toISOString(),
    severity: log.severity,
  }))

  return {
    totalEvents: logs.length,
    eventsByType,
    eventsBySeverity,
    uniqueIPs: uniqueIpSet.size,
    recentEvents,
    activeAlerts: suspiciousCount,
    suspiciousIPs,
  }
}
