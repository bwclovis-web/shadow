import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getPerfumeHouseById } from "@/models/house.server"
import { getPendingSubmissions } from "@/models/pending-submission.server"
import { getPerfumeById } from "@/models/perfume.server"

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
  const editLinksBySubmissionId: Record<
    string,
    { perfumeEditUrl?: string; houseEditUrl?: string }
  > = {}

  for (const submission of submissions) {
    const data = submission.submissionData as Record<string, unknown>
    const placeholderPerfumeId =
      typeof data.placeholderPerfumeId === "string"
        ? data.placeholderPerfumeId
        : undefined
    const placeholderHouseId =
      typeof data.placeholderHouseId === "string" ? data.placeholderHouseId : undefined

    if (placeholderPerfumeId) {
      const perfume = await getPerfumeById(placeholderPerfumeId)
      if (perfume?.slug) {
        editLinksBySubmissionId[submission.id] = {
          ...(editLinksBySubmissionId[submission.id] ?? {}),
          perfumeEditUrl: `/admin/perfume/${perfume.slug}/edit`,
        }
      }
    }

    if (placeholderHouseId) {
      const house = await getPerfumeHouseById(placeholderHouseId)
      if (house?.slug) {
        editLinksBySubmissionId[submission.id] = {
          ...(editLinksBySubmissionId[submission.id] ?? {}),
          houseEditUrl: `/admin/perfume-house/${house.slug}/edit`,
        }
      }
    }
  }

  return (
    <PendingSubmissionClient
      submissions={submissions}
      editLinksBySubmissionId={editLinksBySubmissionId}
    />
  )
}

export default PendingSubmissionPage
