import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import ComparePageClient from "./ComparePageClient"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("compare.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function ComparePage() {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const userId = session?.user?.id ?? null

  return <ComparePageClient userId={userId} />
}
