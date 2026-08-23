import type { AuditStats } from "@/app/admin/types/security-stats"

import { getRequestCorrelationId } from "@/utils/server/structured-log.server"

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
  /** Request correlation ID when logged inside a request (middleware `x-correlation-id`). */
  correlationId?: string
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
  /** Override auto-detected request correlation ID */
  correlationId?: string
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
 * Log an audit event, store in memory, and emit one structured JSON line (with correlationId when available).
 */
export const logAuditEvent = async (
  event: LogAuditEventInput
): Promise<AuditLogEntry> => {
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
    correlationId: correlationIdOverride,
  } = event

  const correlationId =
    correlationIdOverride ?? (await getRequestCorrelationId()) ?? undefined

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
    ...(correlationId ? { correlationId } : {}),
  }

  const key = `${category}-${level}`
  const logs = auditLogs.get(key) ?? []
  logs.push(auditLog)
  if (logs.length > MAX_LOGS_PER_KEY) {
    logs.shift()
  }
  auditLogs.set(key, logs)

  const structured = {
    type: "audit" as const,
    auditId: auditLog.id,
    ts: auditLog.timestamp,
    level: auditLog.level,
    category: auditLog.category,
    action: auditLog.action,
    outcome: auditLog.outcome,
    userId: auditLog.userId,
    ipAddress: auditLog.ipAddress,
    resource: auditLog.resource,
    ...(auditLog.correlationId ? { correlationId: auditLog.correlationId } : {}),
  }
  const line = JSON.stringify(structured)

  if (
    level === AUDIT_LEVELS.CRITICAL ||
    level === AUDIT_LEVELS.ERROR
  ) {
    console.error(line)
  } else if (level === AUDIT_LEVELS.WARN) {
    console.warn(line)
  } else {
    console.log(line)
  }

  if (process.env.NODE_ENV === "development") {
    console.debug(formatAuditLog(auditLog))
  }

  // Dual-write to durable SecurityAuditLog when possible
  void persistAuditToDatabase(auditLog).catch(() => {
    /* never block on audit persistence */
  })

  return auditLog
}

const mapActionToSecurityAudit = (
  action: string
): import("@prisma/client").SecurityAuditAction => {
  const upper = action.toUpperCase().replace(/[\s-]+/g, "_")
  const known = new Set([
    "LOGIN_SUCCESS",
    "LOGIN_FAILED",
    "LOGOUT",
    "PASSWORD_CHANGE",
    "PROFILE_UPDATE",
    "ADMIN_ACCESS",
    "DATA_ACCESS",
    "DATA_MODIFICATION",
    "DATA_DELETION",
    "SUSPICIOUS_ACTIVITY",
    "RATE_LIMIT_EXCEEDED",
    "INVALID_TOKEN",
    "UNAUTHORIZED_ACCESS",
    "CSRF_VIOLATION",
    "SQL_INJECTION_ATTEMPT",
    "XSS_ATTEMPT",
    "FILE_UPLOAD",
    "API_ACCESS",
    "SYSTEM_ERROR",
    "SECURITY_SCAN",
  ])
  if (known.has(upper)) {
    return upper as import("@prisma/client").SecurityAuditAction
  }
  return "API_ACCESS"
}

const mapLevelToSeverity = (
  level: string
): import("@prisma/client").SecurityAuditSeverity => {
  if (level === AUDIT_LEVELS.CRITICAL) return "critical"
  if (level === AUDIT_LEVELS.ERROR) return "error"
  if (level === AUDIT_LEVELS.WARN) return "warning"
  return "info"
}

const persistAuditToDatabase = async (entry: AuditLogEntry): Promise<void> => {
  const { logSecurityAudit } = await import(
    "@/utils/security/security-audit.server"
  )
  await logSecurityAudit({
    userId: entry.userId,
    action: mapActionToSecurityAudit(entry.action),
    severity: mapLevelToSeverity(entry.level),
    resource: entry.resource ?? entry.category,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    details: {
      outcome: entry.outcome,
      category: entry.category,
      ...(entry.details ?? {}),
      ...(entry.correlationId ? { correlationId: entry.correlationId } : {}),
    },
  })
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
