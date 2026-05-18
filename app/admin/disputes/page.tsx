import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getDisputesForAdmin } from "@/models/trade-dispute.server"
import { getUserReportsForAdmin } from "@/models/user-report.server"

import DisputesAdminClient from "./DisputesAdminClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("adminDisputes.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const AdminDisputesPage = async () => {
  const [disputes, reports] = await Promise.all([
    getDisputesForAdmin("all"),
    getUserReportsForAdmin("all"),
  ])

  return <DisputesAdminClient disputes={disputes} reports={reports} />
}

export default AdminDisputesPage
