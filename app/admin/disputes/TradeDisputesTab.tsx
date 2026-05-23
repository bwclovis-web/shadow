"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { DisputeResolutionOutcome, DisputeStatus } from "@prisma/client"

import { Button } from "@/components/Atoms/Button/Button"
import { CSRFToken } from "@/components/Molecules/CSRFToken"
import ListingPhotos from "@/components/Molecules/ListingPhotos/ListingPhotos"
import type { TradeDisputeWithRelations } from "@/models/trade-dispute.server"
import { formatDateTime } from "@/utils/formatters"
import { getTraderDisplayName } from "@/utils/user"
import StrikeIndicators from "@/app/admin/users/StrikeIndicators"

import {
  markUnderReviewAction,
  resolveDisputeAction,
  saveAdminNotesAction,
  type DisputeAdminActionState,
} from "./actions"

type TradeDisputesTabProps = {
  disputes: TradeDisputeWithRelations[]
}

type StatusFilter = "open" | "underReview" | "resolved" | "all"

const RESOLUTION_OUTCOMES: DisputeResolutionOutcome[] = [
  "noAction",
  "warningIssued",
  "strikeIssued",
  "tradeVoided",
]

const ACTIVE_STATUSES: DisputeStatus[] = ["open", "underReview"]


const inputClassName =
  "w-full rounded border border-noir-gold-500/50 bg-noir-black px-3 py-2 text-sm text-noir-gold-100"

const TradeDisputesTab = ({ disputes }: TradeDisputesTabProps) => {
  const router = useRouter()
  const t = useTranslations("adminDisputes")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [reviewState, reviewAction] = useActionState(
    markUnderReviewAction,
    null as DisputeAdminActionState
  )
  const [notesState, notesAction] = useActionState(
    saveAdminNotesAction,
    null as DisputeAdminActionState
  )
  const [resolveState, resolveAction] = useActionState(
    resolveDisputeAction,
    null as DisputeAdminActionState
  )

  const feedback = reviewState ?? notesState ?? resolveState

  useEffect(() => {
    if (reviewState?.success || notesState?.success || resolveState?.success) {
      router.refresh()
    }
  }, [reviewState?.success, notesState?.success, resolveState?.success, router])

  const openCount = disputes.filter((d) => d.status === "open").length
  const underReviewCount = disputes.filter((d) => d.status === "underReview").length
  const resolvedCount = disputes.filter((d) => d.status === "resolved").length

  const displayDisputes =
    statusFilter === "all"
      ? disputes
      : disputes.filter((d) => d.status === statusFilter)

  return (
    <div>
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
          variant={statusFilter === "open" ? "primary" : "secondary"}
          onClick={() => setStatusFilter("open")}
        >
          {t("filters.open")} ({openCount})
        </Button>
        <Button
          variant={statusFilter === "underReview" ? "primary" : "secondary"}
          onClick={() => setStatusFilter("underReview")}
        >
          {t("filters.underReview")} ({underReviewCount})
        </Button>
        <Button
          variant={statusFilter === "resolved" ? "primary" : "secondary"}
          onClick={() => setStatusFilter("resolved")}
        >
          {t("filters.resolved")} ({resolvedCount})
        </Button>
        <Button
          variant={statusFilter === "all" ? "primary" : "secondary"}
          onClick={() => setStatusFilter("all")}
        >
          {t("filters.all")} ({disputes.length})
        </Button>
      </div>

      <div className="space-y-4">
        {displayDisputes.length === 0 ? (
          <p className="py-12 text-center text-noir-gold-100/80">{t("empty")}</p>
        ) : (
          displayDisputes.map((dispute) => {
            const initiatorName = getTraderDisplayName(dispute.initiatedBy)
            const otherPartyName = getTraderDisplayName(dispute.otherParty)
            const isExpanded = expandedId === dispute.id
            const isActive = ACTIVE_STATUSES.includes(dispute.status)

            return (
              <article
                key={dispute.id}
                className="noir-border rounded-lg bg-noir-dark/10 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-noir-gold-100/70">
                      {formatDateTime(dispute.createdAt)}
                    </p>
                    <p className="mt-1 text-sm text-noir-gold-100/90">
                      {t("exchange")}:{" "}
                      <span className="font-mono text-noir-gold">{dispute.tradeId}</span>
                      <span className="ml-2 text-noir-gold-100/70">
                        ({dispute.trade.status})
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-noir-gold-100/90">
                      {t("initiator")}:{" "}
                      <Link
                        href={`/trader-profile/${dispute.initiatedByUserId}`}
                        className="text-noir-gold hover:underline"
                      >
                        {initiatorName}
                      </Link>
                    </p>
                    <h3 className="mt-1 text-lg text-noir-gold-100">
                      {t("otherParty")}:{" "}
                      <Link
                        href={`/trader-profile/${dispute.otherPartyUserId}`}
                        className="text-noir-gold hover:underline"
                      >
                        {otherPartyName}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm">
                      <span className="font-medium text-noir-gold">
                        {t(`categories.${dispute.category}`)}
                      </span>
                      <span className="mx-2 text-noir-gold-100/50">·</span>
                      <span className="uppercase text-noir-gold-100/70">
                        {t(`status.${dispute.status}`)}
                      </span>
                    </p>
                    {dispute.resolutionOutcome ? (
                      <p className="mt-1 text-sm text-noir-gold-100/90">
                        {t("resolutionOutcome")}:{" "}
                        <span className="font-medium text-noir-gold">
                          {t(`outcomes.${dispute.resolutionOutcome}`)}
                        </span>
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <StrikeIndicators
                        strikeCount={dispute.otherParty.strikeCount}
                        isBanned={dispute.otherParty.isBanned}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {dispute.status === "open" ? (
                      <form action={reviewAction} className="inline-flex">
                        <CSRFToken />
                        <input type="hidden" name="disputeId" value={dispute.id} />
                        <Button type="submit" variant="secondary">
                          {t("markUnderReview")}
                        </Button>
                      </form>
                    ) : null}
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : dispute.id)
                      }
                    >
                      {isExpanded ? t("hideDetails") : t("showDetails")}
                    </Button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="mt-4 border-t border-noir-gold-500/30 pt-4 text-sm text-noir-gold-100/90">
                    {dispute.description ? (
                      <p className="mb-3 whitespace-pre-wrap">{dispute.description}</p>
                    ) : (
                      <p className="mb-3 italic text-noir-gold-100/60">
                        {t("noDescription")}
                      </p>
                    )}

                    {dispute.images.length > 0 ? (
                      <ListingPhotos images={dispute.images} className="mb-4" />
                    ) : null}

                    <form action={notesAction} className="mb-6 space-y-3">
                      <CSRFToken />
                      <input type="hidden" name="disputeId" value={dispute.id} />
                      <label className="block">
                        <span className="mb-1 block font-medium text-noir-gold">
                          {t("adminNotesLabel")}
                        </span>
                        <textarea
                          name="adminNotes"
                          rows={4}
                          defaultValue={dispute.adminNotes ?? ""}
                          className={inputClassName}
                        />
                      </label>
                      <Button type="submit" variant="secondary" size="sm">
                        {t("saveNotes")}
                      </Button>
                    </form>

                    {isActive ? (
                      <form action={resolveAction} className="space-y-4">
                        <CSRFToken />
                        <input type="hidden" name="disputeId" value={dispute.id} />
                        <input
                          type="hidden"
                          name="strikeTargetUserId"
                          value={dispute.otherPartyUserId}
                        />

                        <fieldset>
                          <legend className="mb-2 font-medium text-noir-gold">
                            {t("resolveHeading")}
                          </legend>
                          <div className="space-y-2">
                            {RESOLUTION_OUTCOMES.map((outcome) => (
                              <label
                                key={outcome}
                                className="flex cursor-pointer items-center gap-2"
                              >
                                <input
                                  type="radio"
                                  name="resolutionOutcome"
                                  value={outcome}
                                  required
                                  className="text-noir-gold"
                                />
                                <span>{t(`outcomes.${outcome}`)}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <label className="block">
                          <span className="mb-1 block font-medium text-noir-gold">
                            {t("publicSummaryLabel")}
                          </span>
                          <textarea
                            name="publicSummary"
                            rows={3}
                            defaultValue={dispute.publicSummary ?? ""}
                            className={inputClassName}
                          />
                        </label>

                        <Button type="submit" variant="primary">
                          {t("resolveDispute")}
                        </Button>
                      </form>
                    ) : null}

                    <p className="mt-4 font-mono text-xs text-noir-gold-100/50">
                      {dispute.id}
                    </p>
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}

export default TradeDisputesTab
