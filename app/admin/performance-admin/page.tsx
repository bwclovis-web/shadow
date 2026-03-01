import type { Metadata } from "next"

import { requireAdminSession } from "@/utils/requireAdmin.server"

import { PerformanceAdminClient } from "./PerformanceAdminClient"

export const ROUTE_PATH = "/admin/performance-admin" as const

export const generateMetadata = (): Metadata => ({
  title: "Performance Admin - Voodoo Perfumes",
  description:
    "Performance monitoring and management admin interface",
})

const PerformanceAdminPage = async () => {
  const session = await requireAdminSession(ROUTE_PATH)

  return <PerformanceAdminClient userRole={session.user.role} />
}

export default PerformanceAdminPage
