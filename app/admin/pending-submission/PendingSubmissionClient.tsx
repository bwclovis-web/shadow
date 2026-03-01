"use client"

import { useActionState, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken, CSRFTokenProvider } from "@/components/Molecules/CSRFToken"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"

import {
  processPendingSubmissionAction,
  type PendingSubmissionActionState,
} from "./actions"

const BANNER_IMAGE = "/images/userAdmin.webp"

export type PendingSubmissionWithRelations = Awaited<
  ReturnType<typeof import("@/models/pending-submission.server").getPendingSubmissions>
>[number]

type PendingSubmissionClientProps = {
  submissions: PendingSubmissionWithRelations[]
}

const PendingSubmissionClient = ({
  submissions,
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

  const pendingSubmissions = submissions.filter((s) => s.status === "pending")
  const approvedSubmissions = submissions.filter((s) => s.status === "approved")
  const rejectedSubmissions = submissions.filter((s) => s.status === "rejected")

  const displaySubmissions =
    selectedStatus === "pending"
      ? pendingSubmissions
      : selectedStatus === "approved"
        ? approvedSubmissions
        : selectedStatus === "rejected"
          ? rejectedSubmissions
          : submissions

  return (
    <CSRFTokenProvider>
      <div>
        <TitleBanner
          image={BANNER_IMAGE}
          heading={t("heading")}
          subheading={t("subheading")}
        />

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
              displaySubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="noir-border rounded-lg bg-noir-dark/10 p-6"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-noir-gold">
                        {(submission.submissionData as Record<string, unknown>).name as string || "Unnamed"}
                      </h3>
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
                        {Object.entries(
                          submission.submissionData as Record<string, unknown>
                        ).map(([key, value]) => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </CSRFTokenProvider>
  )
}

export default PendingSubmissionClient
