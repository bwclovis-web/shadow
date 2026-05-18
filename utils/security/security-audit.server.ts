import type {
  Prisma,
  SecurityAuditAction,
  SecurityAuditSeverity,
} from "@prisma/client"

import { prisma } from "@/lib/db"

const createAuditId = (): string =>
  `audit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

export const logSecurityAudit = async (params: {
  userId: string | null
  action: SecurityAuditAction
  severity?: SecurityAuditSeverity
  resource?: string
  resourceId?: string
  ipAddress?: string | null
  userAgent?: string | null
  details?: Prisma.InputJsonValue
  metadata?: Prisma.InputJsonValue
}): Promise<void> => {
  await prisma.securityAuditLog.create({
    data: {
      id: createAuditId(),
      userId: params.userId,
      action: params.action,
      severity: params.severity ?? "info",
      resource: params.resource ?? "User",
      resourceId: params.resourceId,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      details: params.details,
      metadata: params.metadata,
    },
  })
}
