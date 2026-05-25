import { type RefObject, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { GrEdit } from "react-icons/gr"
import { MdDeleteForever } from "react-icons/md"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import Modal from "@/components/Organisms/Modal"
import DangerModal from "@/components/Organisms/DangerModal"
import { sanitizeReviewHtml } from "@/utils/sanitize"
import { styleMerge } from "@/utils/styleUtils"
import { useSessionStore } from "@/hooks/sessionStore"

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
  onEdit?: (
    reviewId: string,
    triggerRef: RefObject<HTMLButtonElement | null>
  ) => void
  onDelete?: (reviewId: string) => void
  onModerate?: (reviewId: string, isApproved: boolean) => void
  showModerationActions?: boolean
  isHighlighted?: boolean
  isRemoving?: boolean
}

const ReviewCard = ({
  review,
  currentUserId,
  currentUserRole,
  onEdit,
  onDelete,
  onModerate,
  showModerationActions = false,
  isHighlighted = false,
  isRemoving = false,
}: ReviewCardProps) => {
  const tCommon = useTranslations("common")
  const tReview = useTranslations("singlePerfume.review")
  const isOwner = currentUserId === review.user.id
  const canModerate = currentUserRole === "admin" || currentUserRole === "editor"
  const canEdit = isOwner || canModerate
  const canDelete = isOwner || canModerate
  const { modalOpen, modalId, toggleModal } = useSessionStore()
  const removeButtonRef = useRef<HTMLButtonElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const deleteModalId = `delete-review-item-${review.id}`
  const showDeleteModal =
    Boolean(modalOpen && modalId && onDelete) && modalId === deleteModalId

  const displayName =
    review.user.username ||
    (review.user.firstName && review.user.lastName
      ? `${review.user.firstName} ${review.user.lastName}`
      : review.user.firstName || review.user.email)

  const formattedDate = (() => {
    try {
      return formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })
    } catch {
      return "Recently"
    }
  })()

  return (
    <>
      {showDeleteModal && onDelete && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading={tReview("dangerModal.heading")}
            description={tReview("dangerModal.description")}
            action={() => onDelete(review.id)}
          />
        </Modal>
      )}
      <div
        data-review-card
        className={styleMerge(
          "group rounded-xl border border-noir-gold/30 bg-white/5 p-4 shadow-sm shadow-noir-black/20 transition-[transform,opacity,background-color,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
          "hover:border-noir-gold/45 hover:bg-white/[0.07] hover:shadow-md hover:shadow-noir-black/30",
          "focus-within:border-noir-gold/50 focus-within:bg-white/[0.08]",
          review.isPending && "border-noir-gold/45 bg-noir-gold/[0.08] opacity-80",
          isHighlighted &&
            "border-noir-gold-500/70 bg-noir-gold/[0.10] shadow-md shadow-noir-gold/10 motion-safe:animate-vault-stamp",
          isRemoving && "pointer-events-none translate-y-2 scale-[0.985] opacity-35"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-noir-light bg-noir-gold">
              <span className="text-sm font-semibold text-noir-dark">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-noir-gold">{displayName}</p>
              <p className="text-xs text-noir-gold-100">{formattedDate}</p>
            </div>
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center gap-2 opacity-75 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
              {isOwner && onEdit && (
                <Button
                  ref={editButtonRef}
                  onClick={() => onEdit(review.id, editButtonRef)}
                  variant="icon"
                  background="gold"
                  size="sm"
                  className="flex items-center justify-between gap-2 opacity-90 transition-[transform,opacity] duration-200 motion-safe:hover:-translate-y-0.5 hover:opacity-100"
                >
                  <span>{tCommon("edit")}</span>
                  <GrEdit size={22} />
                </Button>
              )}
              {canDelete && onDelete && (
                <Button
                  ref={removeButtonRef}
                  onClick={() => toggleModal(removeButtonRef, deleteModalId)}
                  variant="icon"
                  background="red"
                  size="sm"
                  className="flex items-center justify-between gap-2 opacity-90 transition-[transform,opacity] duration-200 motion-safe:hover:-translate-y-0.5 hover:opacity-100"
                >
                  <span>{tCommon("delete")}</span>
                  <MdDeleteForever size={22} />
                </Button>
              )}
              {showModerationActions && canModerate && onModerate && (
                <div className="flex items-center gap-1 rounded-full border border-noir-gold/20 bg-noir-black/30 px-2 py-1">
                  <button
                    onClick={() => onModerate(review.id, true)}
                    className="rounded-full px-2 py-1 text-xs text-green-500 transition-colors duration-200 hover:text-green-400 focus-visible:text-green-300"
                  >
                    {tCommon("approve")}
                  </button>
                  <button
                    onClick={() => onModerate(review.id, false)}
                    className="rounded-full px-2 py-1 text-xs text-orange-500 transition-colors duration-200 hover:text-orange-400 focus-visible:text-orange-300"
                  >
                    {tCommon("reject")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Review Content – sanitized at render for defense-in-depth (legacy/untrusted data) */}
        <div
          className="prose prose-sm mt-3 max-w-none text-noir-light transition-colors duration-300"
          dangerouslySetInnerHTML={{ __html: sanitizeReviewHtml(review.review) }}
        />

        {/* Moderation Status */}
        {(showModerationActions || review.isPending) && (
          <div className="mt-3 text-xs text-noir-gold-100">
            Status:{" "}
            {review.isPending ? (
              <span className="font-medium text-blue-500">Submitting...</span>
            ) : review.isApproved ? (
              <span className="font-medium text-green-500">Approved</span>
            ) : (
              <span className="font-medium text-orange-400">Pending Review</span>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default ReviewCard
