import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getPendingSubmissions } from "@/models/pending-submission.server"

import PendingSubmissionClient from "./PendingSubmissionClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("pendingSubmissions.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const PendingSubmissionPage = async () => {
  const submissions = await getPendingSubmissions()

  return <PendingSubmissionClient submissions={submissions} />
}

export default PendingSubmissionPage
