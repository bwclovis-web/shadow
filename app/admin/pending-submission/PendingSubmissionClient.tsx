"use client"

import { useActionState, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken, CSRFTokenProvider } from "@/components/Molecules/CSRFToken"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import {
  extractInventoryIntent,
  isCsvImportSubmission,
  MANUAL_COLLECTION_SOURCE,
  stripPerfumeMetadataForDisplay,
} from "@/lib/csv-import-pending-submission"

import {
  processPendingSubmissionAction,
  type PendingSubmissionActionState,
} from "./actions"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/userAdmin.webp"

export type PendingSubmissionWithRelations = Awaited<
  ReturnType<typeof import("@/models/pending-submission.server").getPendingSubmissions>
>[number]

type PendingSubmissionClientProps = {
  submissions: PendingSubmissionWithRelations[]
  editLinksBySubmissionId: Record<
    string,
    { perfumeEditUrl?: string; houseEditUrl?: string }
  >
}

const PendingSubmissionClient = ({
  submissions,
  editLinksBySubmissionId,
}: PendingSubmissionClientProps) => {
  const router = useRouter()
  const t = useTranslations("pendingSubmissions")
  const [state, formAction] = useActionState(
    processPendingSubmissionAction,
    null as PendingSubmissionActionState
  )
  const [selectedStatus, setSelectedStatus] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending")
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(
    null
  )

  useEffect(() => {
    if (state?.success) {
      router.refresh()
    }
  }, [state?.success, router])

  const pendingSubmissions = submissions.filter(s => s.status === "pending")
  const approvedSubmissions = submissions.filter(s => s.status === "approved")
  const rejectedSubmissions = submissions.filter(s => s.status === "rejected")

  const displaySubmissions =
    selectedStatus === "pending"
      ? pendingSubmissions
      : selectedStatus === "approved"
        ? approvedSubmissions
        : selectedStatus === "rejected"
          ? rejectedSubmissions
          : submissions

  const submissionById = new Map(submissions.map(s => [s.id, s]))

  const getLinkedHouseBlockReason = (
    data: Record<string, unknown>
  ): string | null => {
    const linkedId =
      typeof data.pendingHouseSubmissionId === "string"
        ? data.pendingHouseSubmissionId
        : undefined
    if (!linkedId) return null
    const linked = submissionById.get(linkedId)
    if (!linked) return null
    if (linked.status === "pending") {
      return t("linkedHousePending", { id: linkedId })
    }
    if (linked.status === "rejected") {
      return t("linkedHouseRejected")
    }
    return null
  }

  return (
    <CSRFTokenProvider>
      <main id="main-content">
        <TitleBanner
          image={BANNER_IMAGE}
          heading={t("heading")}
          subheading={t("subheading")}
        />

        <PageWrapper>
          {state && (
            <div
              className={`mb-6 rounded-md p-4 ${
                state.success
                  ? "border border-green-400 bg-green-100 text-green-700"
                  : "border border-red-400 bg-red-100 text-red-700"
              }`}
            >
              {state.success ? state.message : state.error}
            </div>
          )}

          <div className="mb-6 flex gap-4">
            <Button
              variant={selectedStatus === "pending" ? "primary" : "secondary"}
              onClick={() => setSelectedStatus("pending")}
            >
              {t("filters.pending")} ({pendingSubmissions.length})
            </Button>
            <Button
              variant={selectedStatus === "approved" ? "primary" : "secondary"}
              onClick={() => setSelectedStatus("approved")}
            >
              {t("filters.approved")} ({approvedSubmissions.length})
            </Button>
            <Button
              variant={selectedStatus === "rejected" ? "primary" : "secondary"}
              onClick={() => setSelectedStatus("rejected")}
            >
              {t("filters.rejected")} ({rejectedSubmissions.length})
            </Button>
            <Button
              variant={selectedStatus === "all" ? "primary" : "secondary"}
              onClick={() => setSelectedStatus("all")}
            >
              {t("filters.all")} ({submissions.length})
            </Button>
          </div>

          <div className="space-y-4">
            {displaySubmissions.length === 0 ? (
              <div className="py-12 text-center text-noir-light">
                <p className="text-lg">{t("empty")}</p>
              </div>
            ) : (
              displaySubmissions.map(submission => {
                const submissionData = submission.submissionData as Record<
                  string,
                  unknown
                >
                const isCsvImport = isCsvImportSubmission(submissionData)
                const isManualCollectionSubmission =
                  submissionData.source === MANUAL_COLLECTION_SOURCE
                const inventoryIntent = extractInventoryIntent(submissionData)
                const linkedHouseBlock = getLinkedHouseBlockReason(submissionData)
                const approveBlocked =
                  submission.status === "pending" &&
                  submission.submissionType === "perfume" &&
                  !!linkedHouseBlock
                const displayFields = isCsvImport
                  ? stripPerfumeMetadataForDisplay(submissionData)
                  : submissionData
                const editLinks = editLinksBySubmissionId[submission.id]

                return (
                  <div
                    key={submission.id}
                    className="noir-border rounded-lg bg-noir-dark/10 p-6"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold text-noir-gold">
                            {(submissionData.name as string) || "Unnamed"}
                          </h3>
                          {isCsvImport && (
                            <span className="rounded-full bg-noir-gold/20 px-2 py-0.5 text-xs font-semibold text-noir-gold">
                              {t("csvImportBadge")}
                            </span>
                          )}
                          {isManualCollectionSubmission && (
                            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300">
                              {t("manualCollectionBadge")}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-noir-light">
                          {submission.submissionType === "perfume"
                            ? "Perfume"
                            : "Perfume House"}{" "}
                          • Submitted{" "}
                          {new Date(submission.createdAt).toLocaleDateString(
                            "en-US"
                          )}
                          {submission.submittedByUser && (
                            <> • by {submission.submittedByUser.email}</>
                          )}
                        </p>
                        {linkedHouseBlock && (
                          <p className="mt-2 text-sm text-amber-300" role="alert">
                            {linkedHouseBlock}
                          </p>
                        )}
                        {(editLinks?.perfumeEditUrl || editLinks?.houseEditUrl) && (
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                            {editLinks?.perfumeEditUrl && (
                              <Link
                                href={editLinks.perfumeEditUrl}
                                className="text-noir-gold underline underline-offset-2 hover:text-noir-light"
                              >
                                {t("editPerfumeEntry")}
                              </Link>
                            )}
                            {editLinks?.houseEditUrl && (
                              <Link
                                href={editLinks.houseEditUrl}
                                className="text-noir-gold underline underline-offset-2 hover:text-noir-light"
                              >
                                {t("editHouseEntry")}
                              </Link>
                            )}
                          </div>
                        )}
                        {submission.status !== "pending" &&
                          submission.reviewedByUser && (
                            <p className="mt-1 text-sm text-noir-light">
                              {submission.status === "approved"
                                ? "Approved"
                                : "Rejected"}{" "}
                              by {submission.reviewedByUser.email} on{" "}
                              {submission.reviewedAt
                                ? new Date(
                                    submission.reviewedAt
                                  ).toLocaleDateString("en-US")
                                : ""}
                            </p>
                          )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          submission.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : submission.status === "approved"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {submission.status}
                      </span>
                    </div>

                    {inventoryIntent && (
                      <div className="mb-4 rounded-lg border border-noir-gold/30 bg-noir-black/20 p-3">
                        <h4 className="mb-2 text-sm font-semibold text-noir-gold">
                          {t("inventoryIntent")}
                        </h4>
                        <ul className="space-y-1 text-sm text-noir-light">
                          <li>
                            {t("inventoryAmount")}: {inventoryIntent.amount}
                          </li>
                          <li>
                            {t("inventoryCondition")}:{" "}
                            {inventoryIntent.condition ?? "—"}
                          </li>
                          <li>
                            {t("inventoryTradePreference")}:{" "}
                            {inventoryIntent.tradePreference}
                          </li>
                        </ul>
                      </div>
                    )}

                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSubmission(
                            expandedSubmission === submission.id
                              ? null
                              : submission.id
                          )
                        }
                        className="text-noir-gold transition-colors hover:text-noir-light"
                      >
                        {expandedSubmission === submission.id
                          ? t("hideDetails")
                          : t("showDetails")}
                      </button>
                    </div>

                    {expandedSubmission === submission.id && (
                      <div className="mt-4 rounded-lg bg-noir-black/30 p-4">
                        <h4 className="mb-2 font-semibold text-noir-gold">
                          {t("details")}
                        </h4>
                        <div className="space-y-2 text-noir-light">
                          {Object.entries(displayFields).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-semibold capitalize text-noir-gold">
                                {key.replace(/([A-Z])/g, " $1").trim()}:{" "}
                              </span>
                              <span>
                                {Array.isArray(value)
                                  ? value.join(", ")
                                  : String(value ?? "N/A")}
                              </span>
                            </div>
                          ))}
                        </div>
                        {submission.adminNotes && (
                          <div className="mt-4 border-t border-noir-gold/30 pt-4">
                            <h5 className="mb-2 font-semibold text-noir-gold">
                              {t("adminNotes")}
                            </h5>
                            <p className="text-noir-light">
                              {submission.adminNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {submission.status === "pending" && (
                      <form
                        action={formAction}
                        className="mt-4 flex flex-wrap items-end gap-4"
                      >
                        <CSRFToken />
                        <input
                          type="hidden"
                          name="submissionId"
                          value={submission.id}
                        />
                        <input
                          type="text"
                          name="adminNotes"
                          placeholder={t("notesPlaceholder")}
                          className="min-w-[200px] flex-1 rounded border border-noir-gold/30 bg-noir-dark px-4 py-2 text-noir-light"
                        />
                        <Button
                          type="submit"
                          name="action"
                          value="approve"
                          variant="primary"
                          className="max-w-max"
                          disabled={approveBlocked}
                        >
                          {t("approve")}
                        </Button>
                        <Button
                          type="submit"
                          name="action"
                          value="reject"
                          variant="danger"
                          className="max-w-max"
                        >
                          {t("reject")}
                        </Button>
                      </form>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </PageWrapper>
      </main>
    </CSRFTokenProvider>
  )
}

export default PendingSubmissionClient
