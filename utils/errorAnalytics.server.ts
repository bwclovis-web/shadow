/**
 * Error analytics types and utilities (server)
 */

export interface ErrorAnalyticsReport {
  period?: string
  startTime?: string | number | Date
  endTime?: string | number | Date
  totalErrors?: number
  errorRate?: number
  criticalErrors?: number
  highErrors?: number
  affectedUsers?: number
  errors?: unknown[]
  trends?: unknown[]
  errorsBySeverity?: { severity: string; count: number; percentage: number }[]
  errorsByType?: { type: string; count: number; percentage: number; lastOccurrence: string }[]
  topErrors?: { code: string; count: number; message: string; lastOccurrence: string }[]
  mostAffectedUsers?: { userId: string; errorCount: number }[]
  hourlyTrend?: { period: string; totalErrors: number }[]
  recentCorrelationIds?: string[]
  [key: string]: unknown
}
