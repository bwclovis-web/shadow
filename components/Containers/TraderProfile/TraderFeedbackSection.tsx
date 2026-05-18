import {
  type FormEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useTranslations } from "next-intl"
import { FaStar, FaThumbsDown, FaThumbsUp } from "react-icons/fa"
import { Button } from "~/components/Atoms/Button"
import Select from "~/components/Atoms/Select"
import type { TraderFeedbackSort } from "@/models/traderFeedback.server"
import type { HelpfulnessVoteValue } from "@/models/traderFeedbackHelpfulness.server"
import { useTraderFeedback, useTraderFeedbackMutations } from "@/hooks/useTraderFeedback"
import { useVoteTraderFeedbackHelpfulness } from "@/lib/mutations/traderFeedbackVotes"
import type {
  TraderFeedbackComment,
  TraderFeedbackResponse,
} from "@/lib/queries/traderFeedback"
import { TRADER_FEEDBACK_RATING_OPTIONS } from "@/utils/constants"
import { formatUserName } from "@/utils/formatters"

const RATING_OPTIONS_REVERSED = [...TRADER_FEEDBACK_RATING_OPTIONS].reverse()

type TraderFeedbackSectionProps = {
  traderId: string
  viewerId?: string | null
  initialData?: TraderFeedbackResponse
}

const StarDisplay = ({ value }: { value: number }) => {
  const normalizedValue = Math.max(0, Math.min(5, value || 0))
  return (
    <>
      {RATING_OPTIONS_REVERSED.map((option) => {
        const isFilled = normalizedValue >= option - 0.25
        const isHalf = !isFilled && normalizedValue >= option - 0.75
        return (
          <FaStar
            key={option}
            className={`h-5 w-5 ${
              isFilled
                ? "text-noir-gold"
                : isHalf
                  ? "text-noir-gold-300"
                  : "text-noir-gold-800"
            }`}
          />
        )
      })}
    </>
  )
}

type FeedbackCommentItemProps = {
  commentEntry: TraderFeedbackComment
  anonymousLabel: string
  traderId: string
  viewerId?: string | null
  verifiedSwapLabel: string
  helpfulLabel: string
  unhelpfulLabel: string
  loginToVoteLabel: string
}

const FeedbackCommentItem = memo(function FeedbackCommentItem({
  commentEntry,
  anonymousLabel,
  traderId,
  viewerId,
  verifiedSwapLabel,
  helpfulLabel,
  unhelpfulLabel,
  loginToVoteLabel,
}: FeedbackCommentItemProps) {
  const voteMutation = useVoteTraderFeedbackHelpfulness()
  const displayName =
    formatUserName(commentEntry.reviewer) || anonymousLabel
  const dateLabel = new Date(commentEntry.createdAt).toLocaleDateString("en-US")

  const cannotVote =
    !viewerId ||
    viewerId === commentEntry.reviewerId ||
    viewerId === traderId

  const handleVote = (value: HelpfulnessVoteValue) => {
    if (cannotVote || voteMutation.isPending) return
    const isSameAsCurrent = commentEntry.viewerHelpfulnessVote === value
    voteMutation.mutate({
      feedbackId: commentEntry.id,
      value: isSameAsCurrent ? null : value,
      traderId,
      viewerId,
    })
  }

  return (
    <li className="border border-noir-gold/40 rounded-lg p-4 bg-noir-black/60">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="font-medium text-noir-gold">{displayName}</div>
        <div className="flex items-center gap-2 text-noir-gold-500 text-sm flex-wrap">
          <StarDisplay value={commentEntry.rating} />
          <span>{commentEntry.rating}/5</span>
          <span className="text-noir-gold-500 text-xs">{dateLabel}</span>
          {commentEntry.verifiedSwap && (
            <span className="inline-flex items-center rounded-full border border-noir-gold/50 bg-noir-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-noir-gold">
              {verifiedSwapLabel}
            </span>
          )}
        </div>
      </div>
      {commentEntry.comment && (
        <p className="mt-2 text-noir-gold-100 text-sm whitespace-pre-line">
          {commentEntry.comment}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-noir-gold/20 pt-3">
        {!viewerId ? (
          <p className="text-xs text-noir-gold-500">{loginToVoteLabel}</p>
        ) : (
          <>
            <button
              type="button"
              disabled={cannotVote || voteMutation.isPending}
              aria-pressed={commentEntry.viewerHelpfulnessVote === "helpful"}
              aria-label={helpfulLabel}
              onClick={() => handleVote("helpful")}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                commentEntry.viewerHelpfulnessVote === "helpful"
                  ? "border-noir-gold bg-noir-gold/20 text-noir-gold"
                  : "border-noir-gold/40 text-noir-gold-300 hover:border-noir-gold/60"
              }`}
            >
              <FaThumbsUp className="h-3.5 w-3.5" aria-hidden />
              <span>{helpfulLabel}</span>
              <span className="text-noir-gold-500">({commentEntry.helpfulCount})</span>
            </button>
            <button
              type="button"
              disabled={cannotVote || voteMutation.isPending}
              aria-pressed={commentEntry.viewerHelpfulnessVote === "unhelpful"}
              aria-label={unhelpfulLabel}
              onClick={() => handleVote("unhelpful")}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
                commentEntry.viewerHelpfulnessVote === "unhelpful"
                  ? "border-noir-gold bg-noir-gold/20 text-noir-gold"
                  : "border-noir-gold/40 text-noir-gold-300 hover:border-noir-gold/60"
              }`}
            >
              <FaThumbsDown className="h-3.5 w-3.5" aria-hidden />
              <span>{unhelpfulLabel}</span>
              <span className="text-noir-gold-500">({commentEntry.unhelpfulCount})</span>
            </button>
          </>
        )}
      </div>
    </li>
  )
})

const TraderFeedbackSection = memo(function TraderFeedbackSection({
  traderId,
  viewerId,
  initialData,
}: TraderFeedbackSectionProps) {
  const t = useTranslations("traderProfile.feedback")
  const [sort, setSort] = useState<TraderFeedbackSort>("top")

  const { data, isLoading, isError, error } = useTraderFeedback(
    traderId,
    viewerId,
    initialData,
    sort
  )
  const {
    submitFeedback,
    deleteFeedback,
    submitMutation,
    deleteMutation,
    isMutating,
  } = useTraderFeedbackMutations()

  const [rating, setRating] = useState<number>(0)
  const [comment, setComment] = useState<string>("")
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (data?.viewerFeedback) {
      setRating(data.viewerFeedback.rating)
      setComment(data.viewerFeedback.comment ?? "")
    } else {
      setRating(0)
      setComment("")
    }
  }, [data?.viewerFeedback])

  useEffect(() => {
    if (submitMutation.isError) {
      setFormError(submitMutation.error?.message ?? t("error"))
    } else if (deleteMutation.isError) {
      setFormError(deleteMutation.error?.message ?? t("error"))
    } else {
      setFormError(null)
    }
  }, [
    submitMutation.isError,
    submitMutation.error,
    deleteMutation.isError,
    deleteMutation.error,
    t,
  ])

  const isViewerTrader = Boolean(viewerId && viewerId === traderId)
  const hasViewerFeedback = Boolean(data?.viewerFeedback)
  const canLeaveFeedback = data?.canLeaveFeedback ?? true

  const ratingSelectOptions = useMemo(
    () => [
      {
        id: 0,
        label: t("selectRating"),
        name: "select-rating",
      },
      ...RATING_OPTIONS_REVERSED.map((option) => ({
        id: option,
        label: String(option),
        name: String(option),
      })),
    ],
    [t]
  )

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!rating) {
        setFormError(t("validation.ratingRequired"))
        return
      }
      submitFeedback({
        traderId,
        rating,
        comment: comment.trim(),
        tradeId: data?.eligibleTradeId ?? undefined,
        viewerId,
      })
    },
    [rating, comment, traderId, viewerId, data?.eligibleTradeId, submitFeedback, t]
  )

  const handleDelete = useCallback(() => {
    deleteFeedback({ traderId, viewerId })
  }, [traderId, viewerId, deleteFeedback])

  const anonymousLabel = t("anonymousReviewer")

  return (
    <section className="noir-border relative w-full p-4 space-y-6 bg-noir-black/40">
      <header>
        <h2>{t("title")}</h2>
        <p className="text-noir-gold-100">{t("subtitle")}</p>
      </header>

      {isLoading && (
        <p className="text-noir-gold-500 text-sm">{t("loading")}</p>
      )}

      {isError && (
        <p className="text-noir-gold-500 text-sm">
          {error?.message || t("error")}
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <div className="space-y-4">
            {data?.comments && data.comments.length > 0 ? (
              <>
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-label={t("sortLabel")}
                >
                  <button
                    type="button"
                    onClick={() => setSort("top")}
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                      sort === "top"
                        ? "border-noir-gold bg-noir-gold/20 text-noir-gold"
                        : "border-noir-gold/40 text-noir-gold-300 hover:border-noir-gold/60"
                    }`}
                  >
                    {t("sortTop")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSort("recent")}
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                      sort === "recent"
                        ? "border-noir-gold bg-noir-gold/20 text-noir-gold"
                        : "border-noir-gold/40 text-noir-gold-300 hover:border-noir-gold/60"
                    }`}
                  >
                    {t("sortRecent")}
                  </button>
                </div>
                <ul className="space-y-3">
                  {data.comments.map((commentEntry) => (
                    <FeedbackCommentItem
                      key={commentEntry.id}
                      commentEntry={commentEntry}
                      anonymousLabel={anonymousLabel}
                      traderId={traderId}
                      viewerId={viewerId}
                      verifiedSwapLabel={t("verifiedSwap")}
                      helpfulLabel={t("helpful")}
                      unhelpfulLabel={t("unhelpful")}
                      loginToVoteLabel={t("loginToVote")}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-noir-gold-500 text-sm">{t("noComments")}</p>
            )}
          </div>

          <div className="border-t border-noir-gold/30 pt-4">
            {viewerId ? (
              isViewerTrader ? (
                <p className="text-noir-gold-500 text-sm">
                  {t("selfReviewNotice")}
                </p>
              ) : !canLeaveFeedback ? (
                <p className="text-noir-gold-500 text-sm">
                  {t("requiresCompletedTrade")}
                </p>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label
                      htmlFor="feedback-rating"
                      className="block text-noir-gold-100 text-sm font-medium mb-2"
                    >
                      {t("ratingLabel")}
                    </label>
                    <div className="flex items-center gap-3">
                      <Select
                        selectId="feedback-rating"
                        selectData={ratingSelectOptions}
                        ariaLabel={t("ratingLabel")}
                        value={rating}
                        disabled={isMutating}
                        action={(event) =>
                          setRating(Number(event.target.value))
                        }
                        className="w-auto!"
                      />
                      <span className="text-noir-gold text-sm">
                        {t("ratingHint")}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="feedback-comment"
                      className="block text-noir-gold-100 text-sm font-medium mb-2"
                    >
                      {t("commentLabel")}
                    </label>
                    <textarea
                      id="feedback-comment"
                      name="comment"
                      className="w-full min-h-[120px] bg-noir-black border border-noir-gold/40 text-noir-gold-100 px-3 py-2 rounded"
                      value={comment}
                      disabled={isMutating}
                      onChange={(event) => setComment(event.target.value)}
                      maxLength={1000}
                      placeholder={t("commentPlaceholder")}
                    />
                    <p className="text-xs text-noir-gold-100 mt-1">
                      {t("commentHint")}
                    </p>
                  </div>

                  {formError && (
                    <p className="text-sm text-red-400">{formError}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      disabled={isMutating}
                      variant="primary"
                    >
                      {hasViewerFeedback
                        ? t("updateButton")
                        : t("submitButton")}
                    </Button>

                    {hasViewerFeedback && (
                      <Button
                        type="button"
                        onClick={handleDelete}
                        disabled={isMutating}
                      >
                        {t("deleteButton")}
                      </Button>
                    )}
                  </div>
                </form>
              )
            ) : (
              <p className="text-noir-gold-500 text-sm">{t("loginPrompt")}</p>
            )}
          </div>
        </>
      )}
    </section>
  )
})

export default TraderFeedbackSection
