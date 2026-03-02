import { type FormEvent, memo, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { FaStar } from "react-icons/fa"
import { Button } from "~/components/Atoms/Button"
import Select from "~/components/Atoms/Select"
import { useTraderFeedback, useTraderFeedbackMutations } from "@/hooks/useTraderFeedback"
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

function StarDisplay({ value }: { value: number }) {
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

const FeedbackCommentItem = memo(function FeedbackCommentItem({
  commentEntry,
  anonymousLabel,
}: {
  commentEntry: TraderFeedbackComment
  anonymousLabel: string
}) {
  const displayName =
    formatUserName(commentEntry.reviewer) || anonymousLabel
  const dateLabel = new Date(commentEntry.createdAt).toLocaleDateString("en-US")

  return (
    <li className="border border-noir-gold/40 rounded-lg p-4 bg-noir-black/60">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="font-medium text-noir-gold">{displayName}</div>
        <div className="flex items-center gap-2 text-noir-gold-500 text-sm">
          <StarDisplay value={commentEntry.rating} />
          <span>{commentEntry.rating}/5</span>
          <span className="text-noir-gold-500 text-xs">{dateLabel}</span>
        </div>
      </div>
      {commentEntry.comment && (
        <p className="mt-2 text-noir-gold-100 text-sm whitespace-pre-line">
          {commentEntry.comment}
        </p>
      )}
    </li>
  )
})

const TraderFeedbackSection = memo(function TraderFeedbackSection({
  traderId,
  viewerId,
  initialData,
}: TraderFeedbackSectionProps) {
  const t = useTranslations("traderProfile.feedback")

  const { data, isLoading, isError, error } = useTraderFeedback(
    traderId,
    viewerId,
    initialData
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

  const totalReviews = data?.summary?.totalReviews ?? 0
  const hasRatings =
    (data?.summary?.averageRating ?? null) !== null && totalReviews > 0

  const averageDisplay = useMemo(() => {
    if (!hasRatings) return t("noRatings")
    return Number(data?.summary?.averageRating ?? 0).toFixed(1)
  }, [data?.summary?.averageRating, hasRatings, t])

  const isViewerTrader = Boolean(viewerId && viewerId === traderId)
  const hasViewerFeedback = Boolean(data?.viewerFeedback)

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
        viewerId,
      })
    },
    [rating, comment, traderId, viewerId, submitFeedback, t]
  )

  const handleDelete = useCallback(() => {
    deleteFeedback({ traderId, viewerId })
  }, [traderId, viewerId, deleteFeedback])

  const anonymousLabel = t("anonymousReviewer")
  const averageRating = data?.summary?.averageRating ?? 0

  return (
    <section className="noir-border relative w-full p-4 space-y-6 bg-noir-black/40">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2>{t("title")}</h2>
          <p className="text-noir-gold-100">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {hasRatings ? (
            <div className="flex items-center gap-1 text-noir-gold">
              <StarDisplay value={averageRating} />
              <span className="text-2xl font-bold">{averageDisplay}</span>
            </div>
          ) : (
            <span className="text-sm text-noir-gold-100">{averageDisplay}</span>
          )}
          <div className="text-sm text-noir-gold-500">
            {t("reviewCount", { count: totalReviews })}
          </div>
          {data?.summary?.badgeEligible && (
            <span className="inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-noir-gold text-noir-black rounded-full">
              {t("badgeLabel")}
            </span>
          )}
        </div>
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
              <ul className="space-y-3">
                {data.comments.map((commentEntry) => (
                  <FeedbackCommentItem
                    key={commentEntry.id}
                    commentEntry={commentEntry}
                    anonymousLabel={anonymousLabel}
                  />
                ))}
              </ul>
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
