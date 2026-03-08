import type { Metadata } from "next"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { redirect } from "next/navigation"

import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import { PerformanceAdminClient } from "./PerformanceAdminClient"

export const generateMetadata = (): Metadata => ({
  title: "Performance Admin - Voodoo Perfumes",
  description:
    "Performance monitoring and management admin interface",
})

const PerformanceAdminPage = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/performance-admin")
  }

  return <PerformanceAdminClient userRole={session.user.role} />
}

export default PerformanceAdminPage
