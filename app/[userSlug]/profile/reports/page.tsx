import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { getUserReportsByReporter } from "@/models/user-report.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

import MyReportsPageClient from "./MyReportsPageClient"

const BANNER_IMAGE = publicAssetUrl("/images/reports.png")

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
  const { user } = await requireOwnedProfileSession(userSlug, { subPath: "reports" })
  const reports = await getUserReportsByReporter(user.id)

  return (
    <MyReportsPageClient
      reports={reports}
      bannerImage={BANNER_IMAGE}
      userSlug={userSlug}
    />
  )
}
