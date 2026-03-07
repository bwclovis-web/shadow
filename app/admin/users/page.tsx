import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { redirect } from "next/navigation"

import { getAllUsersWithCounts } from "@/models/admin.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import { UsersClient } from "./UsersClient"

export const ROUTE_PATH = "/admin/users" as const

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("userAdmin.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const UsersPage = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/users")
  }

  const users = await getAllUsersWithCounts()

  return (
    <UsersClient
      users={users}
      currentUserId={session.user.id}
    />
  )
}

export default UsersPage
