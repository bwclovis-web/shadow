import { useTranslations } from "next-intl"
import { MdDeleteForever } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import VooDooCheck from "@/components/Atoms/VooDooCheck/VooDooCheck"
import { usePerfumeComments } from "@/hooks/usePerfumeComments"
import { useSessionStore } from "@/hooks/sessionStore"
import type { UserPerfumeI } from "@/types"

interface PerfumeCommentsProps {
  userPerfume: UserPerfumeI
  onCommentSuccess?: () => void
}
const PerfumeComments = ({ userPerfume, onCommentSuccess }: PerfumeCommentsProps) => {
  const t = useTranslations("myScents.comments")
  const { toggleModal } = useSessionStore()
  const { comments, uniqueModalId, toggleCommentVisibility, deleteComment } =
    usePerfumeComments({ userPerfume, onCommentSuccess })

  const handleTogglePublic = async (commentId: string, currentIsPublic: boolean) => {
    await toggleCommentVisibility(commentId, currentIsPublic)
  }

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(commentId)
  }

  return (
    <div className="mt1 p-4 rounded-b-md bg-noir-dark/80">
      <h3 className="text-lg font-semibold">{t("heading")}</h3>
      <p className="text-sm mb-2 text-noir-gold-500">
        {t("subheading", {
          perfumeName: userPerfume.perfume.name,
        })}
      </p>
      {comments.length > 0 ? (
        <ul className="list-decimal">
          {comments.map(comment => (
            <ol
              key={comment.id}
              className="mb-1 border-b border-noir-gold/20 pb-2"
            >
              <p className="text-lg text-noir-gold-100">{comment.comment}</p>
              <div className="flex items-center justify-between mt-2 bg-noir-black rounded-sm pl-1">
                <span className="text-xs text-noir-gold-500 font-bold tracking-wide">
                  Created on : {new Date(comment.createdAt).toLocaleDateString("en-US")}
                </span>
                <div className="flex items-center gap-2">
                  <VooDooCheck
                    checked={comment.isPublic}
                    labelChecked={t("makePublic")}
                    labelUnchecked={t("makePrivate")}
                    onChange={() => handleTogglePublic(comment.id, comment.isPublic)}
                  />
                  <Button
                    variant="icon"
                    onClick={() => handleDeleteComment(comment.id)}
                    background={"red"}
                    size="sm"
                    leftIcon={<MdDeleteForever size={20} fill="white" />}
                  >
                      {t("deleteComment")}
                  </Button>
                </div>
              </div>
            </ol>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-noir-gold-500 mb-2">
          {t("noComments")}
        </p>
      )}
      <Button
        className="mt-2"
        onClick={() => {
          const buttonRef = { current: document.createElement("button") }
          toggleModal(buttonRef as any, uniqueModalId, { action: "create" })
        }}
        size={"sm"}
      >
        {t("addCommentButton")}
      </Button>
    </div>
  )
}

export default PerfumeComments
