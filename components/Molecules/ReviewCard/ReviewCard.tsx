import { formatDistanceToNow } from "date-fns"
import { GrEdit } from "react-icons/gr"
import { MdDeleteForever } from "react-icons/md"

import { Button } from "~/components/Atoms/Button"
import Modal from "~/components/Organisms/Modal"
import { sanitizeReviewHtml } from "~/utils/sanitize"
import { styleMerge } from "~/utils/styleUtils"
import { useSessionStore } from "~/stores/sessionStore"
import DangerModal from "~/components/Organisms/DangerModal"
import { useTranslation } from "react-i18next"
import { useRef } from "react"
interface ReviewCardProps {
  review: {
    id: string
    review: string
    createdAt: string
    isApproved?: boolean
    isPending?: boolean // Flag for optimistic/pending reviews
    user: {
      id: string
      username?: string | null
      firstName?: string | null
      lastName?: string | null
      email: string
    }
  }
  currentUserId?: string
  currentUserRole?: string
  onEdit?: (reviewId: string) => void
  onDelete?: (reviewId: string) => void
  onModerate?: (reviewId: string, isApproved: boolean) => void
  showModerationActions?: boolean
}

const ReviewCard = ({
  review,
  currentUserId,
  currentUserRole,
  onEdit,
  onDelete,
  onModerate,
  showModerationActions = false,
}: ReviewCardProps) => {
  const { t } = useTranslation()
  const isOwner = currentUserId === review.user.id
  const canModerate = currentUserRole === "admin" || currentUserRole === "editor"
  const canEdit = isOwner || canModerate
  const canDelete = isOwner || canModerate
  const { modalOpen, modalId, toggleModal } = useSessionStore()
  const removeButtonRef = useRef<HTMLButtonElement>(null)
  const deleteModalId = `delete-review-item-${review.id}`
  const getDisplayName = () => {
    if (review.user.username) {
      return review.user.username
    }
    if (review.user.firstName && review.user.lastName) {
      return `${review.user.firstName} ${review.user.lastName}`
    }
    if (review.user.firstName) {
      return review.user.firstName
    }
    // Show email as fallback
    return review.user.email
  }

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return "Recently"
    }
  }

  return (
    <>
    {modalOpen && modalId && onDelete && modalId === deleteModalId && (
      <Modal innerType="dark" animateStart="top">
        <DangerModal
          heading={t("singlePerfume.review.dangerModal.heading")}
          description={t("singlePerfume.review.dangerModal.description")}
          action={() => onDelete(review.id)}
        />
      </Modal>
    )}
    <div
      className={styleMerge(
        "bg-white/5 border border-noir-gold rounded-lg p-4 space-y-3",
        review.isPending && "opacity-60 animate-pulse"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-noir-gold rounded-full flex items-center justify-center border border-noir-light">
            <span className="text-noir-dark text-sm font-semibold">
              {getDisplayName().charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-noir-gold">{getDisplayName()}</p>
            <p className="text-xs text-noir-gold-100">
              {formatDate(review.createdAt)}
            </p>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex items-center space-x-2">
            {isOwner && onEdit && (
              <Button
                onClick={() => onEdit(review.id)}
                variant="icon"
                background="gold"
                size="sm"
                className="flex items-center justify-between gap-2"
              >
                <span>{t("common.edit")}</span>
                <GrEdit size={22} />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                onClick={() => toggleModal(removeButtonRef, deleteModalId)}
                variant="icon"
                background="red"
                size="sm"
                className="flex items-center justify-between gap-2"
              >
                <span>{t("common.delete")}</span>
                <MdDeleteForever size={22} />
              </Button>
            )}
            {showModerationActions && canModerate && onModerate && (
              <div className="flex space-x-1">
                <button
                  onClick={() => onModerate(review.id, true)}
                  className="text-xs text-green-600 hover:text-green-800 hover:underline"
                >
                  {t("common.approve")}
                </button>
                <button
                  onClick={() => onModerate(review.id, false)}
                  className="text-xs text-orange-600 hover:text-orange-800 hover:underline"
                >
                  {t("common.reject")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Content – sanitized at render for defense-in-depth (legacy/untrusted data) */}
      <div
        className="prose prose-sm max-w-none text-noir-light"
        dangerouslySetInnerHTML={{ __html: sanitizeReviewHtml(review.review) }}
      />

      {/* Moderation Status */}
      {(showModerationActions || review.isPending) && (
        <div className="text-xs">
          Status:{" "}
          {review.isPending ? (
            <span className="font-medium text-blue-600">⏳ Submitting...</span>
          ) : review.isApproved ? (
            <span className="font-medium text-green-600">✓ Approved</span>
          ) : (
            <span className="font-medium text-orange-600">⏳ Pending Review</span>
          )}
        </div>
      )}
    </div>
    </>
  )
}

export default ReviewCard
