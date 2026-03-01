import type { AuditStats } from "@/app/admin/types/security-stats"

/** Single audit log entry as stored in memory */
export interface AuditLogEntry {
  id: string
  timestamp: string
  level: string
  category: string
  action: string
  userId: string | null
  ipAddress: string | null
  userAgent: string | null
  resource: string | null
  details: Record<string, unknown>
  outcome: string
}

/** Input for logging an audit event */
export interface LogAuditEventInput {
  level?: string
  category?: string
  action: string
  userId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  resource?: string | null
  details?: Record<string, unknown>
  outcome?: string
}

/** Filters for querying audit logs */
export interface GetAuditLogsFilters {
  category?: string | null
  level?: string | null
  userId?: string | null
  ipAddress?: string | null
  startDate?: string | null
  endDate?: string | null
  limit?: number
}

const auditLogs = new Map<string, AuditLogEntry[]>()

export const AUDIT_LEVELS = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  CRITICAL: "critical",
} as const

export const AUDIT_CATEGORIES = {
  AUTHENTICATION: "authentication",
  AUTHORIZATION: "authorization",
  DATA_ACCESS: "data_access",
  CONFIGURATION: "configuration",
  SECURITY: "security",
  PERFORMANCE: "performance",
  SYSTEM: "system",
} as const

const MAX_LOGS_PER_KEY = 1000

const generateAuditId = (): string =>
  `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

const formatAuditLog = (log: AuditLogEntry): string => {
  const { timestamp, level, category, action, userId, ipAddress, outcome } = log
  const emoji =
    level === AUDIT_LEVELS.CRITICAL
      ? "🚨"
      : level === AUDIT_LEVELS.ERROR
        ? "❌"
        : level === AUDIT_LEVELS.WARN
          ? "⚠️"
          : "📝"
  return `${emoji} [${timestamp}] ${level.toUpperCase()} ${category.toUpperCase()}: ${action} (${outcome}) ${
    userId ? `[User: ${userId}]` : ""
  } ${ipAddress ? `[IP: ${ipAddress}]` : ""}`
}

/**
 * Log an audit event and optionally emit to console.
 */
export const logAuditEvent = (event: LogAuditEventInput): AuditLogEntry => {
  const {
    level = AUDIT_LEVELS.INFO,
    category = AUDIT_CATEGORIES.SYSTEM,
    action,
    userId = null,
    ipAddress = null,
    userAgent = null,
    resource = null,
    details = {},
    outcome = "success",
  } = event

  const auditLog: AuditLogEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    level,
    category,
    action,
    userId,
    ipAddress,
    userAgent,
    resource,
    details,
    outcome,
  }

  const key = `${category}-${level}`
  const logs = auditLogs.get(key) ?? []
  logs.push(auditLog)
  if (logs.length > MAX_LOGS_PER_KEY) {
    logs.shift()
  }
  auditLogs.set(key, logs)

  const logMessage = formatAuditLog(auditLog)
  if (
    level === AUDIT_LEVELS.CRITICAL ||
    level === AUDIT_LEVELS.ERROR
  ) {
    console.error(logMessage)
  } else if (level === AUDIT_LEVELS.WARN) {
    console.warn(logMessage)
  } else {
    console.log(logMessage)
  }

  return auditLog
}

/**
 * Get audit logs with optional filters.
 */
export const getAuditLogs = (
  filters: GetAuditLogsFilters = {}
): AuditLogEntry[] => {
  const {
    category = null,
    level = null,
    userId = null,
    ipAddress = null,
    startDate = null,
    endDate = null,
    limit = 100,
  } = filters

  let allLogs: AuditLogEntry[] = []
  for (const logs of auditLogs.values()) {
    allLogs = allLogs.concat(logs)
  }

  let filtered = allLogs
  if (category) filtered = filtered.filter((log) => log.category === category)
  if (level) filtered = filtered.filter((log) => log.level === level)
  if (userId) filtered = filtered.filter((log) => log.userId === userId)
  if (ipAddress) filtered = filtered.filter((log) => log.ipAddress === ipAddress)
  if (startDate) {
    const start = new Date(startDate)
    filtered = filtered.filter((log) => new Date(log.timestamp) >= start)
  }
  if (endDate) {
    const end = new Date(endDate)
    filtered = filtered.filter((log) => new Date(log.timestamp) <= end)
  }

  return filtered
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
}

/**
 * Get audit statistics for the security monitor. Returns shape expected by AuditStats.
 */
export const getAuditStats = (): AuditStats => {
  const logsByLevel: Record<string, number> = {}
  const logsByCategory: Record<string, number> = {}
  const logsByOutcome: Record<string, number> = {}
  const uniqueUsers = new Set<string>()
  const uniqueIPs = new Set<string>()
  const recentLogsRaw: AuditLogEntry[] = []

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  let totalLogs = 0

  for (const logs of auditLogs.values()) {
    totalLogs += logs.length
    for (const log of logs) {
      logsByLevel[log.level] = (logsByLevel[log.level] ?? 0) + 1
      logsByCategory[log.category] = (logsByCategory[log.category] ?? 0) + 1
      logsByOutcome[log.outcome] = (logsByOutcome[log.outcome] ?? 0) + 1
      if (log.userId) uniqueUsers.add(log.userId)
      if (log.ipAddress) uniqueIPs.add(log.ipAddress)
      if (new Date(log.timestamp) > oneHourAgo) recentLogsRaw.push(log)
    }
  }

  const recentLogs = recentLogsRaw
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50)
    .map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      category: log.category,
      action: log.action,
      ipAddress: log.ipAddress ?? "",
      outcome: log.outcome,
    }))

  return {
    totalLogs,
    logsByLevel,
    logsByCategory,
    logsByOutcome,
    recentLogs,
    uniqueUsers: uniqueUsers.size,
    uniqueIPs: uniqueIPs.size,
  }
}

/**
 * Remove audit logs older than 7 days. Call periodically (e.g. daily) in long-running processes.
 */
export const cleanupAuditLogs = (): void => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  for (const [key, logs] of auditLogs.entries()) {
    const kept = logs.filter((log) => new Date(log.timestamp) > oneWeekAgo)
    if (kept.length === 0) {
      auditLogs.delete(key)
    } else {
      auditLogs.set(key, kept)
    }
  }
}

// Run cleanup every 24h when this module is loaded (e.g. Node server). No-op in serverless if process is short-lived.
if (typeof setInterval !== "undefined") {
  setInterval(cleanupAuditLogs, 24 * 60 * 60 * 1000)
}
