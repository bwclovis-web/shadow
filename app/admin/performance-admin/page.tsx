import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import { PerformanceAdminClient } from "./PerformanceAdminClient"

export const ROUTE_PATH = "/admin/performance-admin" as const

export const generateMetadata = (): Metadata => ({
  title: "Performance Admin - Voodoo Perfumes",
  description:
    "Performance monitoring and management admin interface",
})

const getCookieHeader = async (): Promise<string> => {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}

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
