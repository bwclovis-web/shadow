export interface SecurityStats {
  totalEvents: number
  eventsByType: Record<string, number>
  eventsBySeverity: Record<string, number>
  uniqueIPs: number
  recentEvents: Array<{
    id: string
    type: string
    ipAddress: string
    path: string
    timestamp: string
    severity: string
  }>
  activeAlerts: number
  suspiciousIPs: number
}

export interface RateLimitStats {
  totalViolations: number
  uniqueIPs: number
  violationsByPath: Record<string, number>
  recentViolations: Array<{
    timestamp: string
    path: string
    limitType: string
    ip: string
  }>
}

export interface AuditStats {
  totalLogs: number
  logsByLevel: Record<string, number>
  logsByCategory: Record<string, number>
  logsByOutcome: Record<string, number>
  recentLogs: Array<{
    id: string
    timestamp: string
    level: string
    category: string
    action: string
    ipAddress: string
    outcome: string
  }>
  uniqueUsers: number
  uniqueIPs: number
}

const emptySecurityStats = (): SecurityStats => ({
  totalEvents: 0,
  eventsByType: {},
  eventsBySeverity: {},
  uniqueIPs: 0,
  recentEvents: [],
  activeAlerts: 0,
  suspiciousIPs: 0,
})

const emptyRateLimitStats = (): RateLimitStats => ({
  totalViolations: 0,
  uniqueIPs: 0,
  violationsByPath: {},
  recentViolations: [],
})

const emptyAuditStats = (): AuditStats => ({
  totalLogs: 0,
  logsByLevel: {},
  logsByCategory: {},
  logsByOutcome: {},
  recentLogs: [],
  uniqueUsers: 0,
  uniqueIPs: 0,
})

export const defaultSecurityStats = emptySecurityStats()
export const defaultRateLimitStats = emptyRateLimitStats()
export const defaultAuditStats = emptyAuditStats()
