import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { redirect } from "next/navigation"

import {
  defaultAuditStats,
  defaultRateLimitStats,
  defaultSecurityStats,
} from "@/app/admin/types/security-stats"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import {
  getAuditStats,
  logAuditEvent,
  AUDIT_LEVELS,
  AUDIT_CATEGORIES,
} from "@/utils/security/audit-logger.server"
import { getRateLimitStats } from "@/utils/security/rate-limit-monitor.server"
import { getSecurityStats } from "@/utils/security/security-monitor.server"

import { SecurityMonitorClient } from "./SecurityMonitorClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("securityMonitor")
  return {
    title: t("heading"),
    description: t("subheading"),
  }
}

const SecurityMonitorPage = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/security-monitor")
  }

  logAuditEvent({
    level: AUDIT_LEVELS.INFO,
    category: AUDIT_CATEGORIES.SECURITY,
    action: "view_security_monitor",
    userId: session.user.id,
    outcome: "success",
  })

  const security = getSecurityStats()
  const rateLimit = getRateLimitStats()
  const audit = getAuditStats()

  const securityData =
    security && typeof security === "object" ? security : defaultSecurityStats
  const rateLimitData =
    rateLimit && typeof rateLimit === "object" ? rateLimit : defaultRateLimitStats
  const auditData =
    audit && typeof audit === "object" ? audit : defaultAuditStats

  return (
    <SecurityMonitorClient
      security={securityData}
      rateLimit={rateLimitData}
      audit={auditData}
    />
  )
}

export default SecurityMonitorPage
