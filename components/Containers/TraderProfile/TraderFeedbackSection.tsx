import { type FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { FaStar } from "react-icons/fa"
import { Button } from "~/components/Atoms/Button"

import Select from "~/components/Atoms/Select"
import { useTraderFeedback, useTraderFeedbackMutations } from "~/hooks/useTraderFeedback"
import type { TraderFeedbackResponse } from "~/lib/queries/traderFeedback"
import { TRADER_FEEDBACK_RATING_OPTIONS } from "~/utils/constants"
import { formatUserName } from "~/utils/formatters"

type TraderFeedbackSectionProps = {
  traderId: string
  viewerId?: string | null
  initialData?: TraderFeedbackResponse
}

// eslint-disable-next-line complexity
const TraderFeedbackSection = ({
  traderId,
  viewerId,
  initialData,
}: TraderFeedbackSectionProps) => {
  const { t } = useTranslation()

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
      setFormError(submitMutation.error?.message || t("traderProfile.feedback.error"))
    } else if (deleteMutation.isError) {
      setFormError(deleteMutation.error?.message || t("traderProfile.feedback.error"))
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
    if (!hasRatings) {
      return t("traderProfile.feedback.noRatings")
    }
    return Number(data?.summary?.averageRating ?? 0).toFixed(1)
  }, [data?.summary?.averageRating, hasRatings, t])

  const isViewerTrader = viewerId && viewerId === traderId
  const hasViewerFeedback = Boolean(data?.viewerFeedback)

  const ratingSelectOptions = useMemo(
    () => [
      {
        id: 0,
        label: t("traderProfile.feedback.selectRating"),
        name: "select-rating",
      },
      ...Array.from(TRADER_FEEDBACK_RATING_OPTIONS)
        .reverse()
        .map(option => ({
          id: option,
          label: option.toString(),
          name: option.toString(),
        })),
    ],
    [t]
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!rating) {
      setFormError(t("traderProfile.feedback.validation.ratingRequired"))
      return
    }
    submitFeedback({
      traderId,
      rating,
      comment: comment.trim(),
      viewerId,
    })
  }

  const handleDelete = () => {
    deleteFeedback({
      traderId,
      viewerId,
    })
  }

  return (
    <section className="noir-border relative w-full p-4 space-y-6 bg-noir-black/40">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2>{t("traderProfile.feedback.title")}</h2>
          <p className="text-noir-gold-100">
            {t("traderProfile.feedback.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasRatings ? (
            <div className="flex items-center gap-1 text-noir-gold">
              {renderStars(data?.summary?.averageRating ?? 0)}
              <span className="text-2xl font-bold">{averageDisplay}</span>
            </div>
          ) : (
            <span className="text-sm text-noir-gold-100">{averageDisplay}</span>
          )}
          <div className="text-sm text-noir-gold-500">
            {t("traderProfile.feedback.reviewCount", { count: totalReviews })}
          </div>
          {data?.summary?.badgeEligible && (
            <span className="inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-noir-gold text-noir-black rounded-full">
              {t("traderProfile.feedback.badgeLabel")}
            </span>
          )}
        </div>
      </header>

      {isLoading && (
        <p className="text-noir-gold-500 text-sm">
          {t("traderProfile.feedback.loading")}
        </p>
      )}

      {isError && (
        <p className="text-noir-gold-500 text-sm">
          {error?.message || t("traderProfile.feedback.error")}
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <div className="space-y-4">
            {data?.comments && data.comments.length > 0 ? (
              <ul className="space-y-3">
                {data.comments.map(commentEntry => (
                  <li
                    key={commentEntry.id}
                    className="border border-noir-gold/40 rounded-lg p-4 bg-noir-black/60"
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="font-medium text-noir-gold">
                        {formatUserName(commentEntry.reviewer) ||
                          t("traderProfile.feedback.anonymousReviewer")}
                      </div>
                      <div className="flex items-center gap-2 text-noir-gold-500 text-sm">
                        {renderStars(commentEntry.rating)}
                        <span>{commentEntry.rating}/5</span>
                        <span className="text-noir-gold-500 text-xs">
                          {new Date(commentEntry.createdAt).toLocaleDateString("en-US")}
                        </span>
                      </div>
                    </div>
                    {commentEntry.comment && (
                      <p className="mt-2 text-noir-gold-100 text-sm whitespace-pre-line">
                        {commentEntry.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-noir-gold-500 text-sm">
                {t("traderProfile.feedback.noComments")}
              </p>
            )}
          </div>

          <div className="border-t border-noir-gold/30 pt-4">
            {viewerId ? (
              isViewerTrader ? (
                <p className="text-noir-gold-500 text-sm">
                  {t("traderProfile.feedback.selfReviewNotice")}
                </p>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="feedback-rating" className="block text-noir-gold-100 text-sm font-medium mb-2">
                      {t("traderProfile.feedback.ratingLabel")}
                    </label>
                    <div className="flex items-center gap-3">
                      <Select
                        selectId="feedback-rating"
                        selectData={ratingSelectOptions}
                        ariaLabel={t("traderProfile.feedback.ratingLabel")}
                        value={rating}
                        disabled={isMutating}
                        action={event => setRating(Number(event.target.value))}
                        className="!w-auto"
                      />
                      <span className="text-noir-gold text-sm">
                        {t("traderProfile.feedback.ratingHint")}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="feedback-comment" className="block text-noir-gold-100 text-sm font-medium mb-2">
                      {t("traderProfile.feedback.commentLabel")}
                    </label>
                    <textarea
                      id="feedback-comment"
                      name="comment"
                      className="w-full min-h-[120px] bg-noir-black border border-noir-gold/40 text-noir-gold-100 px-3 py-2 rounded"
                      value={comment}
                      disabled={isMutating}
                      onChange={event => setComment(event.target.value)}
                      maxLength={1000}
                      placeholder={t("traderProfile.feedback.commentPlaceholder")}
                    />
                    <p className="text-xs text-noir-gold-100 mt-1">
                      {t("traderProfile.feedback.commentHint")}
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
                        ? t("traderProfile.feedback.updateButton")
                        : t("traderProfile.feedback.submitButton")}
                    </Button>

                    {hasViewerFeedback && (
                      <Button
                        type="button"
                        onClick={handleDelete}
                        disabled={isMutating}
                      >
                        {t("traderProfile.feedback.deleteButton")}
                      </Button>
                    )}
                  </div>
                </form>
              )
            ) : (
              <p className="text-noir-gold-500 text-sm">
                {t("traderProfile.feedback.loginPrompt")}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function renderStars(value: number) {
  const normalizedValue = Math.max(0, Math.min(5, value || 0))
  return Array.from(TRADER_FEEDBACK_RATING_OPTIONS)
    .map(option => {
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
    })
    .reverse()
}

export default TraderFeedbackSection

