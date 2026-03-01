import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import { DataQualityClient } from "./DataQualityClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("dataQuality")
  return {
    title: t("heading"),
    description: t("subheading"),
  }
}

const getCookieHeader = async (): Promise<string> => {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}

const DataQualityPage = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/data-quality")
  }

  const isAdmin =
    session.user.role === "admin" || session.user.role === "editor"

  if (!isAdmin) {
    redirect("/unauthorized")
  }

  return <DataQualityClient isAdmin={isAdmin} />
}

export default DataQualityPage
