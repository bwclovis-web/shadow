import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getUserReportsForAdmin } from "@/models/user-report.server"

import ReportsClient from "./ReportsClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("adminReports.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const AdminReportsPage = async () => {
  const reports = await getUserReportsForAdmin("all")

  return <ReportsClient reports={reports} />
}

export default AdminReportsPage
