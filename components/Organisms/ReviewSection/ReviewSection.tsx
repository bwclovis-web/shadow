import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/Atoms/Button"
import RichTextEditor from "~/components/Atoms/RichTextEditor"
import ReviewCard from "~/components/Molecules/ReviewCard"
import { useCSRF } from "~/hooks/useCSRF"
import { safeAsync } from "~/utils/errorHandling.patterns"
import { containsDangerousReviewHtml, sanitizeReviewHtml } from "~/utils/sanitize"

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

const ReviewSection = ({
  perfumeId,
  currentUserId,
  currentUserRole,
  canCreateReview = false,
  existingUserReview,
  initialReviewsData,
  pageSize,
}: ReviewSectionProps) => {
  const { t } = useTranslation()
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewContent, setReviewContent] = useState("")
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const [userReview, setUserReview] = useState(existingUserReview || null)
  const [reviewsState, setReviewsState] = useState(initialReviewsData)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const { submitForm } = useCSRF()

  useEffect(() => {
    setReviewsState(initialReviewsData)
  }, [initialReviewsData])

  useEffect(() => {
    setUserReview(existingUserReview || null)
  }, [existingUserReview])

  const reviews = reviewsState?.reviews ?? []
  const hasMore = reviewsState?.pagination?.hasNextPage ?? false
  const currentPage = reviewsState?.pagination?.page ?? 1
  const fetchLimit = useMemo(() => reviewsState?.pagination?.limit ?? pageSize, [pageSize, reviewsState])

  const updateReviewsState = useCallback(
    (nextData: Review[], pagination: ReviewsPagination) => {
      setReviewsState(prev => {
        if (!prev || pagination.page === 1) {
          return { reviews: nextData, pagination }
        }

        const existingIds = new Set(prev.reviews.map(review => review.id))
        const merged = [...prev.reviews]

        nextData.forEach(review => {
          if (!existingIds.has(review.id)) {
            merged.push(review)
          }
        })

        return {
          reviews: merged,
          pagination,
        }
      })
    },
    []
  )

  const fetchReviews = useCallback(
    async (pageToLoad: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true)
        }

        const params = new URLSearchParams({
          perfumeId,
          page: pageToLoad.toString(),
          limit: fetchLimit.toString(),
          isApproved: "true",
        })

        const response = await fetch(`/api/reviews?${params}`)

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}))
          throw new Error(errorPayload.message || "Failed to fetch reviews")
        }

        const payload = await response.json()
        updateReviewsState(payload.reviews || [], payload.pagination)
      } catch (error) {
        console.error("Failed to fetch reviews", error)
        alert(error instanceof Error
            ? error.message
            : t("singlePerfume.review.failedToLoadReviews"))
      } finally {
        setIsLoadingMore(false)
      }
    },
    [
fetchLimit, perfumeId, t, updateReviewsState
]
  )

  const refreshReviews = useCallback(async () => fetchReviews(1, false), [fetchReviews])

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      void fetchReviews(currentPage + 1, true)
    }
  }

  // Helper to update a review in state (for optimistic updates)
  const updateReviewInState = useCallback((reviewId: string, updatedReview: Review) => {
    setReviewsState(prev => {
      if (!prev) return prev
      
      const updatedReviews = prev.reviews.map(review =>
        review.id === reviewId ? updatedReview : review
      )
      
      return {
        ...prev,
        reviews: updatedReviews,
      }
    })
    
    // Also update userReview if it's the one being edited
    if (userReview?.id === reviewId) {
      setUserReview(updatedReview)
    }
  }, [userReview])

  const handleCreateReview = async () => {
    if (containsDangerousReviewHtml(reviewContent)) {
      alert(t("singlePerfume.review.failedToCreateReview"))
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
            t("singlePerfume.review.failedToCreateReview"))
      }

      const result = await response.json()
      setReviewContent("")
      setShowReviewForm(false)
      setUserReview(result?.data || null)
      await refreshReviews()
    } catch (error) {
      console.error("Failed to create review", error)
      alert(error instanceof Error
          ? error.message
          : t("singlePerfume.review.failedToCreateReview"))
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleEditReview = (reviewId: string) => {
    // Find the review to edit
    const reviewToEdit = userReview?.id === reviewId 
      ? userReview 
      : reviews.find(r => r.id === reviewId)
    
    if (!reviewToEdit) {
      console.error("Review not found for editing")
      return
    }

    // Set editing state
    setEditingReviewId(reviewId)
    setReviewContent(reviewToEdit.review)
    setShowReviewForm(true)
  }

  const handleUpdateReview = async () => {
    if (!editingReviewId) {
      return
    }

    if (containsDangerousReviewHtml(reviewContent)) {
      alert(t("singlePerfume.review.failedToUpdateReview"))
      return
    }

    const sanitizedReview = sanitizeReviewHtml(reviewContent)

    if (!sanitizedReview.trim()) {
      return
    }

    // Find the original review for optimistic update
    const originalReview = userReview?.id === editingReviewId 
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
            t("singlePerfume.review.failedToUpdateReview"))
      }

      const result = await response.json()
      // Update with server response (includes updated timestamp, etc.)
      updateReviewInState(editingReviewId, result?.data || optimisticReview)
      
      setReviewContent("")
      setShowReviewForm(false)
      setEditingReviewId(null)
      
      // Refresh to ensure consistency
      await refreshReviews()
    } catch (error) {
      console.error("Failed to update review", error)
      alert(error instanceof Error
          ? error.message
          : t("singlePerfume.review.failedToUpdateReview"))
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleCancelEdit = () => {
    setReviewContent("")
    setShowReviewForm(false)
    setEditingReviewId(null)
  }

  const handleDeleteReview = async (reviewId: string, isUserReview = false) => {
    try {
      const formData = new FormData()
      formData.append("_action", "delete")
      formData.append("reviewId", reviewId)

      const response = await submitForm("/api/reviews", formData)

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.error ||
            errorPayload.message ||
            t("singlePerfume.review.failedToDeleteReview"))
      }

      if (isUserReview) {
        setUserReview(null)
      }

      await refreshReviews()
    } catch (error) {
      console.error("Failed to delete review", error)
      alert(error instanceof Error
          ? error.message
          : t("singlePerfume.review.failedToDeleteReview"))
    }
  }

  const handleModerateReview = async (reviewId: string, isApproved: boolean) => {
    // For moderation, we still use the old pattern since there's no mutation yet
    // TODO: Create useModerateReview mutation with optimistic updates
    const formData = new FormData()
    formData.append("_action", "moderate")
    formData.append("reviewId", reviewId)
    formData.append("isApproved", isApproved.toString())

    const [error, response] = await safeAsync(() => submitForm("/api/reviews", formData))

    if (error) {
      console.error(t("singlePerfume.review.failedToModerateReview"), error)
      alert(t("singlePerfume.review.failedToModerateReview"))
      return
    }

    const [jsonError, result] = await safeAsync(() => response.json())

    if (jsonError || !result.success) {
      console.error(t("singlePerfume.review.failedToModerateReview"), jsonError)
      alert(result?.error || t("singlePerfume.review.failedToModerateReview"))
      return
    }

    // Refetch reviews after moderation
    await refreshReviews()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-noir-dark rounded-lg p-4">
        <h2 className="text-xl font-semibold">
          {t("singlePerfume.review.heading")} ({reviews.length})
        </h2>
        {canCreateReview && !userReview && (
          <Button onClick={() => setShowReviewForm(true)}>
            {t("singlePerfume.review.writeReview")}
          </Button>
        )}
      </div>

      {/* Review Form */}
      {showReviewForm && (
        <div className="border border-noir-gold bg-noir-dark rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            {editingReviewId 
              ? t("singlePerfume.review.editYourReview")
              : t("singlePerfume.review.writeYourReview")}
          </h3>
          <RichTextEditor
            value={reviewContent}
            onChange={setReviewContent}
            placeholder={t("singlePerfume.review.addReviewPlaceholder")}
            maxLength={2000}
          />
          <div className="flex justify-end space-x-2">
            <Button
              onClick={editingReviewId ? handleUpdateReview : handleCreateReview}
              disabled={!reviewContent.trim() || isSubmittingReview}
              className="px-4 py-2 bg-noir-gold text-noir-black rounded-md hover:bg-noir-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmittingReview
                ? t("singlePerfume.review.submitting")
                : editingReviewId
                  ? t("singlePerfume.review.updateReview")
                  : t("singlePerfume.review.submitReview")}
            </Button>
            <Button 
              onClick={handleCancelEdit}
              variant="secondary"
              disabled={isSubmittingReview}
            >
              {t("singlePerfume.review.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Existing User Review */}
      {userReview && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">
            {t("singlePerfume.review.yourReview")}
          </h3>
          <ReviewCard
            review={userReview}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onEdit={handleEditReview}
            onDelete={() => handleDeleteReview(userReview.id, true)}
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
              showModerationActions={
                currentUserRole === "admin" || currentUserRole === "editor"
              }
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
                {t("singlePerfume.review.loadMoreReviews")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-lg py-8 text-noir-gold">
          <p>{t("singlePerfume.review.noReviews")}</p>
        </div>
      )}
    </div>
  )
}

export default ReviewSection
