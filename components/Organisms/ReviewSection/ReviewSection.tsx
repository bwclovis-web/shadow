"use client"

import { type RefObject, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"

const RichTextEditor = dynamic(
  () => import("@/components/Atoms/RichTextEditor"),
  { ssr: false }
)
import ReviewCard from "@/components/Molecules/ReviewCard"
import Modal from "@/components/Organisms/Modal"
import { useCSRF } from "@/hooks/useCSRF"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { useSessionStore } from "@/hooks/sessionStore"
import { getReviews } from "@/lib/queries/reviews"
import { safeAsync } from "@/utils/errorHandling.patterns"
import { containsDangerousReviewHtml, sanitizeReviewHtml } from "@/utils/sanitize"
import { LuBookOpenText } from "react-icons/lu"

interface Review {
  id: string
  review: string
  createdAt: string
  isApproved: boolean
  user: {
    id: string
    username?: string | null
    firstName?: string | null
    lastName?: string | null
    email: string
  }
}

interface ReviewsPagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface ReviewsData {
  reviews: Review[]
  pagination: ReviewsPagination
}

interface ReviewSectionProps {
  perfumeId: string
  currentUserId?: string
  currentUserRole?: string
  canCreateReview?: boolean
  existingUserReview?: Review | null
  initialReviewsData: ReviewsData | null
  pageSize: number
}

const REVIEW_STAGGER = 0.05
const REVIEW_FEEDBACK_MS = 1400

const ReviewSection = ({
  perfumeId,
  currentUserId,
  currentUserRole,
  canCreateReview = false,
  existingUserReview,
  initialReviewsData,
  pageSize,
}: ReviewSectionProps) => {
  const t = useTranslations("singlePerfume.review")
  const reviewModalId = `perfume-review-form-${perfumeId}`
  const writeReviewButtonRef = useRef<HTMLButtonElement>(null)
  const wasReviewModalOpenRef = useRef(false)
  const { modalOpen, modalId, toggleModal, closeModal } = useSessionStore()
  const isReviewModalOpen = modalOpen && modalId === reviewModalId
  const [reviewContent, setReviewContent] = useState("")
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const [userReviewOverride, setUserReviewOverride] = useState<Review | null>(null)
  const [reviewsOverride, setReviewsOverride] = useState<ReviewsData | null>(null)
  const userReview = userReviewOverride ?? existingUserReview ?? null
  const reviewsState = reviewsOverride ?? initialReviewsData
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null)
  const [removingReviewIds, setRemovingReviewIds] = useState<string[]>([])
  const { submitForm } = useCSRF()
  const reviewListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ours = modalOpen && modalId === reviewModalId
    if (wasReviewModalOpenRef.current && !ours) {
      setReviewContent("")
      setEditingReviewId(null)
    }
    wasReviewModalOpenRef.current = ours
  }, [modalOpen, modalId, reviewModalId])

  useEffect(() => {
    if (!highlightedReviewId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedReviewId(null)
    }, REVIEW_FEEDBACK_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [highlightedReviewId])

  const reviews = reviewsState?.reviews ?? []
  const hasMore = reviewsState?.pagination?.hasNextPage ?? false
  const currentPage = reviewsState?.pagination?.page ?? 1
  const fetchLimit = reviewsState?.pagination?.limit ?? pageSize
  const showModerationActions =
    currentUserRole === "admin" || currentUserRole === "editor"

  useGsapStagger(reviewListRef, {
    selector: "[data-review-card]",
    deps: [
      userReview?.id ?? "no-user-review",
      reviews
        .map(review => review.id)
        .join(","),
    ],
    enabled: Boolean(userReview) || reviews.length > 0,
    stagger: REVIEW_STAGGER,
    from: { opacity: 0, y: 14 },
    to: {
      opacity: 1,
      y: 0,
      duration: 0.34,
      ease: "power2.out",
      clearProps: "transform,opacity",
    },
  })

  const updateReviewsState = (nextData: Review[], pagination: ReviewsPagination) => {
    setReviewsOverride(prev => {
      const base = prev ?? initialReviewsData
      if (!base || pagination.page === 1) {
        return { reviews: nextData, pagination }
      }
      const existingIds = new Set(base.reviews.map(review => review.id))
      const merged = [...base.reviews]
      nextData.forEach(review => {
        if (!existingIds.has(review.id)) merged.push(review)
      })
      return { reviews: merged, pagination }
    })
  }

  const fetchReviews = async (pageToLoad: number, append = false) => {
    try {
      if (append) setIsLoadingMore(true)
      const payload = await getReviews(
        { perfumeId, isApproved: true },
        { page: pageToLoad, limit: fetchLimit }
      )
      updateReviewsState(payload.reviews || [], payload.pagination)
    } catch (error) {
      console.error("Failed to fetch reviews", error)
      alert(
        error instanceof Error ? error.message : t("failedToLoadReviews")
      )
    } finally {
      setIsLoadingMore(false)
    }
  }

  const refreshReviews = async () => fetchReviews(1, false)

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      void fetchReviews(currentPage + 1, true)
    }
  }

  const updateReviewInState = (reviewId: string, updatedReview: Review) => {
    setReviewsOverride(prev => {
      const base = prev ?? initialReviewsData
      if (!base) return prev
      return {
        ...base,
        reviews: base.reviews.map(review =>
          review.id === reviewId ? updatedReview : review
        ),
      }
    })
    if (userReview?.id === reviewId) setUserReviewOverride(updatedReview)
  }

  const handleCreateReview = async () => {
    if (containsDangerousReviewHtml(reviewContent)) {
      alert(t("failedToCreateReview"))
      return
    }

    const sanitizedReview = sanitizeReviewHtml(reviewContent)

    if (!sanitizedReview.trim()) {
      return
    }

    try {
      setIsSubmittingReview(true)
      const formData = new FormData()
      formData.append("_action", "create")
      formData.append("perfumeId", perfumeId)
      formData.append("review", sanitizedReview)

      const response = await submitForm("/api/reviews", formData)

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error ||
            errorPayload.message ||
            t("failedToCreateReview"))
      }

      const result = await response.json()
      setReviewContent("")
      closeModal()
      setUserReviewOverride(result?.data || null)
      setHighlightedReviewId(result?.data?.id ?? null)
      await refreshReviews()
    } catch (error) {
      console.error("Failed to create review", error)
      alert(error instanceof Error
          ? error.message
          : t("failedToCreateReview"))
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleEditReview = (
    reviewId: string,
    triggerRef: RefObject<HTMLButtonElement | null>
  ) => {
    const reviewToEdit =
      userReview?.id === reviewId ? userReview : reviews.find(r => r.id === reviewId)

    if (!reviewToEdit) {
      console.error("Review not found for editing")
      return
    }

    setEditingReviewId(reviewId)
    setReviewContent(reviewToEdit.review)

    const { modalOpen: storeOpen, modalId: storeModalId } = useSessionStore.getState()
    if (storeOpen && storeModalId === reviewModalId) {
      return
    }
    toggleModal(triggerRef, reviewModalId)
  }

  const handleUpdateReview = async () => {
    if (!editingReviewId) {
      return
    }

    if (containsDangerousReviewHtml(reviewContent)) {
      alert(t("failedToUpdateReview"))
      return
    }

    const sanitizedReview = sanitizeReviewHtml(reviewContent)

    if (!sanitizedReview.trim()) {
      return
    }

    const originalReview =
      userReview?.id === editingReviewId
        ? userReview
        : reviews.find(r => r.id === editingReviewId)

    if (!originalReview) {
      console.error("Review not found for update")
      return
    }

    // Optimistic update: immediately update UI
    const optimisticReview: Review = {
      ...originalReview,
      review: sanitizedReview,
    }
    updateReviewInState(editingReviewId, optimisticReview)

    try {
      setIsSubmittingReview(true)
      const formData = new FormData()
      formData.append("_action", "update")
      formData.append("reviewId", editingReviewId)
      formData.append("review", sanitizedReview)

      const response = await submitForm("/api/reviews", formData)

      if (!response.ok) {
        // Revert optimistic update on error
        updateReviewInState(editingReviewId, originalReview)
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error ||
            errorPayload.message ||
            t("failedToUpdateReview"))
      }

      const result = await response.json()
      // Update with server response (includes updated timestamp, etc.)
      updateReviewInState(editingReviewId, result?.data || optimisticReview)
      setHighlightedReviewId(result?.data?.id ?? editingReviewId)

      setReviewContent("")
      closeModal()
      setEditingReviewId(null)

      // Refresh to ensure consistency
      await refreshReviews()
    } catch (error) {
      console.error("Failed to update review", error)
      alert(error instanceof Error
          ? error.message
          : t("failedToUpdateReview"))
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleCancelEdit = () => {
    closeModal()
    setReviewContent("")
    setEditingReviewId(null)
  }

  const handleDeleteReview = async (reviewId: string, isUserReview = false) => {
    try {
      setRemovingReviewIds(prev =>
        prev.includes(reviewId) ? prev : [...prev, reviewId]
      )
      const formData = new FormData()
      formData.append("_action", "delete")
      formData.append("reviewId", reviewId)

      const response = await submitForm("/api/reviews", formData)

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error ||
            errorPayload.message ||
            t("failedToDeleteReview"))
      }

      if (isUserReview) {
        setUserReviewOverride(null)
      }

      await refreshReviews()
    } catch (error) {
      setRemovingReviewIds(prev => prev.filter(id => id !== reviewId))
      console.error("Failed to delete review", error)
      alert(error instanceof Error
          ? error.message
          : t("failedToDeleteReview"))
    } finally {
      setRemovingReviewIds(prev => prev.filter(id => id !== reviewId))
    }
  }

  const handleModerateReview = async (reviewId: string, isApproved: boolean) => {
    const formData = new FormData()
    formData.append("_action", "moderate")
    formData.append("reviewId", reviewId)
    formData.append("isApproved", isApproved.toString())

    const [error, response] = await safeAsync(() => submitForm("/api/reviews", formData))

    if (error) {
      console.error(t("failedToModerateReview"), error)
      alert(t("failedToModerateReview"))
      return
    }

    const [jsonError, result] = await safeAsync(() => response.json())

    if (jsonError || !result.success) {
      console.error(t("failedToModerateReview"), jsonError)
      alert(result?.error || t("failedToModerateReview"))
      return
    }

    // Refetch reviews after moderation
    await refreshReviews()
  }

  return (
    <div className="space-y-4" ref={reviewListRef}>
      <div className="flex items-center justify-between bg-noir-dark rounded-lg p-4">
        <h2 className="text-xl font-semibold">
          {t("heading")} ({reviews.length})
        </h2>
        {canCreateReview && !userReview && (
          <Button
            ref={writeReviewButtonRef}
            onClick={() => {
              setEditingReviewId(null)
              setReviewContent("")
              toggleModal(writeReviewButtonRef, reviewModalId)
            }}
            leftIcon={<LuBookOpenText size={20} />}
          >
            {t("writeReview")}
          </Button>
        )}
      </div>

      {isReviewModalOpen && (
        <Modal
          innerType="dark"
          animateStart="top"
          className="max-w-4xl"
          dialogAriaLabelledBy="review-modal-form-title"
        >
          <div className="space-y-4">
            <h3
              id="review-modal-form-title"
              className="text-lg font-medium text-noir-gold pr-10"
            >
              {editingReviewId ? t("editYourReview") : t("writeYourReview")}
            </h3>
            <RichTextEditor
              value={reviewContent}
              onChange={setReviewContent}
              placeholder={t("addReviewPlaceholder")}
              maxLength={2000}
            />
            <div className="flex justify-end space-x-2">
              <Button
                onClick={editingReviewId ? handleUpdateReview : handleCreateReview}
                disabled={!reviewContent.trim() || isSubmittingReview}
                className="px-4 py-2 bg-noir-gold text-noir-black rounded-md hover:bg-noir-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmittingReview
                  ? t("submitting")
                  : editingReviewId
                    ? t("updateReview")
                    : t("submitReview")}
              </Button>
              <Button
                onClick={handleCancelEdit}
                variant="secondary"
                disabled={isSubmittingReview}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Existing User Review */}
      {userReview && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-noir-gold">
            {t("yourReview")}
          </h3>
          <ReviewCard
            review={userReview}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onEdit={handleEditReview}
            onDelete={() => handleDeleteReview(userReview.id, true)}
            isHighlighted={highlightedReviewId === userReview.id}
            isRemoving={removingReviewIds.includes(userReview.id)}
          />
        </div>
      )}

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onEdit={handleEditReview}
              onDelete={handleDeleteReview}
              onModerate={handleModerateReview}
              showModerationActions={showModerationActions}
              isHighlighted={highlightedReviewId === review.id}
              isRemoving={removingReviewIds.includes(review.id)}
            />
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 text-noir-gold hover:text-noir-gold/80 transition-colors disabled:opacity-60"
                disabled={isLoadingMore}
              >
                {t("loadMoreReviews")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-lg py-8 text-noir-gold">
          <p>{t("noReviews")}</p>
        </div>
      )}
    </div>
  )
}

export default ReviewSection
