"use client"

import Link from "next/link"
import { useActionState, useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { UserReportStatus } from "@prisma/client"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken, CSRFTokenProvider } from "@/components/Molecules/CSRFToken"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import DangerModal from "@/components/Organisms/DangerModal"
import Modal from "@/components/Organisms/Modal"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { UserReportWithRelations } from "@/models/user-report.server"
import { getTraderDisplayName } from "@/utils/user"
import StrikeIndicators from "@/app/admin/users/StrikeIndicators"
import ConfirmStrikeModal from "@/app/admin/users/ConfirmStrikeModal"
import FormPendingSync from "@/app/admin/users/FormPendingSync"
import { useSessionStore } from "@/hooks/sessionStore"

import {
  deleteReportAction,
  issueStrikeFromReportAction,
  updateReportStatusAction,
  type ReportAdminActionState,
} from "./actions"

const BANNER_IMAGE = "/images/userAdmin.webp"
const DELETE_MODAL_ID = "delete-user-report"

type ReportsClientProps = {
  reports: UserReportWithRelations[]
}

type StatusFilter = UserReportStatus | "all"

type StrikeTarget = {
  reportId: string
  userId: string
  category: string
  description: string | null
  defaultReason: string
}

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const ReportsClient = ({ reports }: ReportsClientProps) => {
  const router = useRouter()
  const t = useTranslations("adminReports")
  const { modalOpen, modalId, toggleModal, closeModal } = useSessionStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("inProgress")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [strikeTarget, setStrikeTarget] = useState<StrikeTarget | null>(null)
  const [showStrikeModal, setShowStrikeModal] = useState(false)
  const [isStrikeSubmitting, setIsStrikeSubmitting] = useState(false)
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null)

  const [statusState, statusAction] = useActionState(
    updateReportStatusAction,
    null as ReportAdminActionState
  )
  const [deleteState, deleteAction] = useActionState(
    deleteReportAction,
    null as ReportAdminActionState
  )
  const [strikeState, strikeAction] = useActionState(
    issueStrikeFromReportAction,
    null as ReportAdminActionState
  )

  const feedback = statusState ?? deleteState ?? strikeState

  useEffect(() => {
    if (statusState?.success || deleteState?.success || strikeState?.success) {
      router.refresh()
    }
  }, [statusState?.success, deleteState?.success, strikeState?.success, router])

  useEffect(() => {
    if (strikeState?.success) {
      setShowStrikeModal(false)
      setStrikeTarget(null)
    }
  }, [strikeState?.success])

  useEffect(() => {
    if (deleteState?.success) {
      closeModal()
      setDeleteReportId(null)
    }
  }, [deleteState?.success, closeModal])

  const inProgress = reports.filter((r) => r.status === "inProgress")
  const settled = reports.filter((r) => r.status === "settled")
  const passed = reports.filter((r) => r.status === "passed")

  const displayReports =
    statusFilter === "all"
      ? reports
      : reports.filter((r) => r.status === statusFilter)

  const openStrikeModal = useCallback((report: UserReportWithRelations) => {
    const defaultReason = `User report (${report.category}, #${report.id.slice(-8)})${
      report.description?.trim() ? ` — ${report.description.trim()}` : ""
    }`
    setStrikeTarget({
      reportId: report.id,
      userId: report.reportedUserId,
      category: report.category,
      description: report.description,
      defaultReason,
    })
    setShowStrikeModal(true)
  }, [])

  const cancelStrike = useCallback(() => {
    setShowStrikeModal(false)
    setStrikeTarget(null)
  }, [])

  const openDeleteModal = (reportId: string, button: HTMLButtonElement) => {
    setDeleteReportId(reportId)
    toggleModal({ current: button } as React.RefObject<HTMLButtonElement>, DELETE_MODAL_ID)
  }

  return (
    <CSRFTokenProvider>
      <div>
        <TitleBanner
          image={BANNER_IMAGE}
          heading={t("heading")}
          subheading={t("subheading")}
        />

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {feedback && (
            <div
              className={`mb-6 rounded-md border p-4 ${
                feedback.success
                  ? "border-green-500/50 bg-green-900/20 text-green-300"
                  : "border-red-400/50 bg-red-900/20 text-red-300"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-3">
            <Button
              variant={statusFilter === "inProgress" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("inProgress")}
            >
              {t("filters.inProgress")} ({inProgress.length})
            </Button>
            <Button
              variant={statusFilter === "settled" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("settled")}
            >
              {t("filters.settled")} ({settled.length})
            </Button>
            <Button
              variant={statusFilter === "passed" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("passed")}
            >
              {t("filters.passed")} ({passed.length})
            </Button>
            <Button
              variant={statusFilter === "all" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("all")}
            >
              {t("filters.all")} ({reports.length})
            </Button>
          </div>

          <div className="space-y-4">
            {displayReports.length === 0 ? (
              <p className="py-12 text-center text-noir-gold-100/80">{t("empty")}</p>
            ) : (
              displayReports.map((report) => {
                const reporterName = getTraderDisplayName(report.reporter)
                const reportedName = getTraderDisplayName(report.reportedUser)
                const isExpanded = expandedId === report.id

                return (
                  <article
                    key={report.id}
                    className="noir-border rounded-lg bg-noir-dark/10 p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-noir-gold-100/70">
                          {formatDate(report.createdAt)}
                        </p>
                        <h3 className="mt-1 text-lg text-noir-gold-100">
                          {t("reportedUser")}:{" "}
                          <Link
                            href={`/trader-profile/${report.reportedUserId}`}
                            className="text-noir-gold hover:underline"
                          >
                            {reportedName}
                          </Link>
                        </h3>
                        <p className="text-sm text-noir-gold-100/90">
                          {t("reporter")}: {reporterName}
                        </p>
                        <p className="mt-1 text-sm">
                          <span className="font-medium text-noir-gold">
                            {t(`categories.${report.category}`)}
                          </span>
                          <span className="mx-2 text-noir-gold-100/50">·</span>
                          <span className="uppercase text-noir-gold-100/70">
                            {t(`status.${report.status}`)}
                          </span>
                        </p>
                        <div className="mt-2">
                          <StrikeIndicators
                            strikeCount={report.reportedUser.strikeCount}
                            isBanned={report.reportedUser.isBanned}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {report.status === "inProgress" && (
                          <Button
                            variant="secondary"
                            onClick={() => openStrikeModal(report)}
                            disabled={report.reportedUser.isBanned}
                          >
                            {t("issueStrike")}
                          </Button>
                        )}
                        <form action={statusAction} className="inline-flex">
                          <CSRFToken />
                          <input type="hidden" name="reportId" value={report.id} />
                          <select
                            name="status"
                            defaultValue={report.status}
                            className="rounded border border-noir-gold-500/50 bg-noir-black px-2 py-1.5 text-sm text-noir-gold-100"
                            aria-label={t("statusLabel")}
                          >
                            <option value="inProgress">{t("status.inProgress")}</option>
                            <option value="settled">{t("status.settled")}</option>
                            <option value="passed">{t("status.passed")}</option>
                          </select>
                          <Button type="submit" variant="secondary" size="sm" className="ml-1">
                            {t("updateStatus")}
                          </Button>
                        </form>
                        <Button
                          variant="secondary"
                          onClick={(e) => openDeleteModal(report.id, e.currentTarget)}
                        >
                          {t("deleteReport")}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : report.id)
                          }
                        >
                          {isExpanded ? t("hideDetails") : t("showDetails")}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 border-t border-noir-gold-500/30 pt-4 text-sm text-noir-gold-100/90">
                        <div className="mb-4 grid gap-2 sm:grid-cols-2">
                          <p>
                            <span className="font-medium text-noir-gold">
                              {t("reporterEmail")}:
                            </span>{" "}
                            <a
                              href={`mailto:${report.reporter.email}`}
                              className="text-noir-gold-100 underline hover:text-noir-gold"
                            >
                              {report.reporter.email}
                            </a>
                          </p>
                          <p>
                            <span className="font-medium text-noir-gold">
                              {t("reportedEmail")}:
                            </span>{" "}
                            <a
                              href={`mailto:${report.reportedUser.email}`}
                              className="text-noir-gold-100 underline hover:text-noir-gold"
                            >
                              {report.reportedUser.email}
                            </a>
                          </p>
                        </div>

                        {report.description ? (
                          <p className="mb-3 whitespace-pre-wrap">{report.description}</p>
                        ) : (
                          <p className="mb-3 italic text-noir-gold-100/60">
                            {t("noDescription")}
                          </p>
                        )}

                        {report.images.length > 0 && (
                          <ListingPhotos images={report.images} className="mb-3" />
                        )}

                        {report.tradeId ? (
                          <p>
                            {t("tradeLink")}:{" "}
                            <span className="font-mono text-noir-gold">
                              {report.tradeId}
                            </span>
                            {report.trade ? (
                              <span className="ml-2 text-noir-gold-100/70">
                                ({report.trade.status})
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        <p className="mt-2 font-mono text-xs text-noir-gold-100/50">
                          {report.id}
                        </p>
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </div>

        <ConfirmStrikeModal
          isOpen={showStrikeModal}
          isSubmitting={isStrikeSubmitting}
          onCancel={cancelStrike}
          formId="report-strike-form"
          defaultReason={strikeTarget?.defaultReason}
        />

        {strikeTarget && (
          <form id="report-strike-form" action={strikeAction} className="hidden">
            <CSRFToken />
            <input type="hidden" name="reportId" value={strikeTarget.reportId} />
            <input type="hidden" name="userId" value={strikeTarget.userId} />
            <input type="hidden" name="category" value={strikeTarget.category} />
            <input
              type="hidden"
              name="description"
              value={strikeTarget.description ?? ""}
            />
            <FormPendingSync onPendingChange={setIsStrikeSubmitting} />
          </form>
        )}

        {modalOpen && modalId === DELETE_MODAL_ID && deleteReportId && (
          <Modal innerType="dark" animateStart="top">
            <DangerModal
              heading={t("deleteConfirmHeading")}
              description={t("deleteConfirmDescription")}
              action={() => {
                const form = document.getElementById(
                  "delete-report-form"
                ) as HTMLFormElement | null
                form?.requestSubmit()
              }}
            />
            <form id="delete-report-form" action={deleteAction} className="hidden">
              <CSRFToken />
              <input type="hidden" name="reportId" value={deleteReportId} />
            </form>
          </Modal>
        )}
      </div>
    </CSRFTokenProvider>
  )
}

export default ReportsClient
