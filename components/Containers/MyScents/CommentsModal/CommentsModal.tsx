import type { FormEvent } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/Atoms/Button/Button"
import VooDooCheck from "~/components/Atoms/VooDooCheck/VooDooCheck"
import { useSessionStore } from "~/stores/sessionStore"
import type { CommentsModalProps } from "~/types/comments"
import { sanitizeString } from "~/utils/validation"

const CommentsModal = ({ perfume, onCommentAdded, addComment }: CommentsModalProps) => {
  const { t } = useTranslation()
  const { toggleModal, modalId } = useSessionStore()
  const [isPublic, setIsPublic] = useState(true) // Default to public
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [comment, setComment] = useState("")

  const closeModal = () => {
    const buttonRef = { current: document.createElement("button") }
    toggleModal(buttonRef as any, modalId || "add-scent")
    setIsSubmitting(false)
    setIsPublic(false)
    setComment("")
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    setIsSubmitting(true)

    // Sanitize input
    const sanitizedComment = sanitizeString(comment)

    // If addComment function is provided, use it (from hook)
    if (addComment) {
      const result = await addComment(sanitizedComment, isPublic)
      if (result.success) {
        setTimeout(() => {
          closeModal()
        }, 1000)
      } else {
        setIsSubmitting(false)
      }
      return
    }

    // Fallback to legacy behavior if addComment is not provided
    // This maintains backward compatibility
    if (onCommentAdded) {
      console.warn("CommentsModal: addComment prop should be provided for better integration")
    }

    setIsSubmitting(false)
  }

  return (
    <div className="p-4">
      <h2>{t("comments.title", "Comments")}</h2>
      <p className="mb-4 text-xl text-noir-gold-100">
        {t(
          "comments.description",
          "This is where you can add your personal comments about the scents."
        )}
      </p>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label
          htmlFor="comment"
          className="block text-md font-medium text-noir-gold-500"
        >
          {t("comments.addLabel", "Add a comment:")}
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={4}
          className="block w-full noir-border p-2 relative resize-none bg-noir-gold-500/10 text-noir-gold-100 
          focus:bg-noir-gold/40 focus:ring-noir-gold focus:border-noir-gold"
          required
        />

        <div className="flex items-center gap-2">
          <VooDooCheck
            id="isPublic"
            checked={isPublic}
            onChange={() => setIsPublic(!isPublic)}
            labelChecked={t("comments.makePublic", "Make this comment public")}
            labelUnchecked={t("comments.makePrivate", "Make this comment private")}
          />
        </div>

        <Button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting
            ? t("comments.submitting", "Submitting...")
            : t("comments.submit", "Submit")}
        </Button>
      </form>
    </div>
  )
}

export default CommentsModal
