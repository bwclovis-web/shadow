import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getPendingSubmissions } from "@/models/pending-submission.server"
import { requireAdminSession } from "@/utils/requireAdmin.server"

import PendingSubmissionClient from "./PendingSubmissionClient"

export const ROUTE_PATH = "/admin/pending-submission" as const

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("pendingSubmissions.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const PendingSubmissionPage = async () => {
  await requireAdminSession(ROUTE_PATH)

  const submissions = await getPendingSubmissions()

  return <PendingSubmissionClient submissions={submissions} />
}

export default PendingSubmissionPage
