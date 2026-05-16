import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { getUserReportsByReporter } from "@/models/user-report.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getProfileSlug } from "@/utils/user"

import MyReportsPageClient from "./MyReportsPageClient"

const BANNER_IMAGE = "/images/userAdmin.webp"

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("myReports.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function MyReportsPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const slug = getProfileSlug(session.user)
  if (slug !== userSlug) {
    redirect(`/${slug}/profile/reports`)
  }

  const reports = await getUserReportsByReporter(session.user.id)

  return (
    <MyReportsPageClient
      reports={reports}
      bannerImage={BANNER_IMAGE}
      userSlug={userSlug}
    />
  )
}
