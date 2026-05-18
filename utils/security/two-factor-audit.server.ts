import type {
  Prisma,
  SecurityAuditAction,
  SecurityAuditSeverity,
} from "@prisma/client"

import { logSecurityAudit } from "@/utils/security/security-audit.server"

export const logTwoFactorAudit = async (params: {
  userId: string | null
  action: SecurityAuditAction
  severity?: SecurityAuditSeverity
  resource?: string
  resourceId?: string
  details?: Prisma.InputJsonValue
}): Promise<void> => {
  await logSecurityAudit({
    userId: params.userId,
    action: params.action,
    severity: params.severity,
    resource: params.resource,
    resourceId: params.resourceId,
    details: params.details,
  })
}
