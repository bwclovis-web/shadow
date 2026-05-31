import { prisma } from "@/lib/db"
import { getAlertsTranslator } from "@/lib/i18n/alerts-translator.server"
import {
  createUserAlert,
  dispatchPushForUserAlert,
  getUserAlertPreferences,
} from "@/models/user-alerts.server"
import type { AlertType, PendingSubmissionType } from "@/types/database"
import { sendSubmissionOutcomeEmail } from "@/utils/alert-email.server"
import { getProfilePathForUser } from "@/utils/user"

export const getSubmissionNameFromData = (
  data: Record<string, unknown> | null
): string =>
  typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "Unknown submission"

type SubmissionOutcomeAlertType = Extract<
  AlertType,
  "submission_approved" | "submission_rejected"
>

type NotifySubmissionOutcomeInput = {
  submitterId: string
  alertType: SubmissionOutcomeAlertType
  submissionId: string
  submissionType: PendingSubmissionType
  submissionName: string
  perfumeId?: string | null
  targetUrl?: string | null
  adminNotes?: string | null
}

export const notifySubmitterOfSubmissionOutcome = async (
  input: NotifySubmissionOutcomeInput
): Promise<void> => {
  const {
    submitterId,
    alertType,
    submissionId,
    submissionType,
    submissionName,
    perfumeId = null,
    targetUrl = null,
    adminNotes = null,
  } = input

  const t = await getAlertsTranslator()
  const title =
    alertType === "submission_approved"
      ? t("titles.submission_approved", { submissionName })
      : t("titles.submission_rejected", { submissionName })

  const trimmedNotes = adminNotes?.trim() || null
  const message =
    alertType === "submission_approved"
      ? t("messages.submission_approved", { submissionName })
      : trimmedNotes
        ? t("messages.submission_rejected_with_notes", {
            submissionName,
            adminNotes: trimmedNotes,
          })
        : t("messages.submission_rejected", { submissionName })

  const metadata = {
    submissionId,
    submissionType,
    submissionName,
    targetUrl,
    adminNotes: trimmedNotes,
  }

  const [preferences, user] = await Promise.all([
    getUserAlertPreferences(submitterId),
    prisma.user.findUnique({
      where: { id: submitterId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        profileSlug: true,
      },
    }),
  ])

  const resolvedTargetUrl =
    targetUrl ??
    (user ? `${getProfilePathForUser(user)}/my-scents` : "/profile/my-scents")

  const metadataWithTarget = { ...metadata, targetUrl: resolvedTargetUrl }

  await createUserAlert(
    submitterId,
    perfumeId,
    alertType,
    title,
    message,
    metadataWithTarget,
    preferences
  )

  dispatchPushForUserAlert({
    userId: submitterId,
    alertType,
    title,
    message,
    metadata: metadataWithTarget,
  })

  if (user) {
    try {
      await sendSubmissionOutcomeEmail({
        user,
        preferences,
        alertType,
        title,
        message,
        targetUrl: resolvedTargetUrl,
      })
    } catch (error) {
      console.error("[submission-alerts] email failed:", error)
    }
  }
}

export const notifySubmissionApproved = async (options: {
  submitterId: string | null | undefined
  submissionId: string
  submissionType: PendingSubmissionType
  submissionData: Record<string, unknown> | null
  perfumeId?: string | null
  perfumeSlug?: string | null
  houseSlug?: string | null
  adminNotes?: string | null
}): Promise<void> => {
  if (!options.submitterId) return

  const submissionName = getSubmissionNameFromData(options.submissionData)
  const targetUrl =
    options.perfumeSlug != null
      ? `/perfume/${options.perfumeSlug}`
      : options.houseSlug != null
        ? `/houses/${options.houseSlug}`
        : null

  await notifySubmitterOfSubmissionOutcome({
    submitterId: options.submitterId,
    alertType: "submission_approved",
    submissionId: options.submissionId,
    submissionType: options.submissionType,
    submissionName,
    perfumeId: options.perfumeId ?? null,
    targetUrl,
    adminNotes: options.adminNotes,
  })
}

export const notifySubmissionRejected = async (options: {
  submitterId: string | null | undefined
  submissionId: string
  submissionType: PendingSubmissionType
  submissionData: Record<string, unknown> | null
  adminNotes?: string | null
}): Promise<void> => {
  if (!options.submitterId) return

  await notifySubmitterOfSubmissionOutcome({
    submitterId: options.submitterId,
    alertType: "submission_rejected",
    submissionId: options.submissionId,
    submissionType: options.submissionType,
    submissionName: getSubmissionNameFromData(options.submissionData),
    perfumeId: null,
    targetUrl: null,
    adminNotes: options.adminNotes,
  })
}
