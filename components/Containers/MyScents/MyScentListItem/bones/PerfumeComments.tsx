import { useTranslations } from "next-intl"
import { MdDeleteForever } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import { useSessionStore } from "@/hooks/sessionStore"
import type { Comment } from "@/types/comments"
import type { UserPerfumeI } from "@/types"
import { LuBookPlus } from "react-icons/lu"

interface PerfumeCommentsProps {
  userPerfume: UserPerfumeI
  comments: Comment[]
  uniqueModalId: string
  deleteComment: (commentId: string) => Promise<{ success: boolean; error?: string }>
}

const PerfumeComments = ({
  userPerfume,
  comments,
  uniqueModalId,
  deleteComment,
}: PerfumeCommentsProps) => {
  const t = useTranslations("myScents.comments")
  const { toggleModal } = useSessionStore()

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(commentId)
  }

  return (
    <div className="p-4 rounded-b-md bg-noir-dark/80">
      <h3>{t("heading")}</h3>
      <p className="mb-4 text-noir-gold-100">{t("subheading2")}</p>
      <p className="text-sm text-noir-gold-500">
        {t("subheading", {
          perfumeName: userPerfume.perfume.name,
        })}
      </p>
      
      {comments.length > 0 ? (
        <ul>
          {comments.map(comment => (
            <li
              key={comment.id}
              className="mb-1 border-b border-noir-gold/20 pb-2"
            >
              <p className="text-lg text-noir-gold-100">{comment.comment}</p>
              <div className="flex items-center justify-between mt-2 bg-noir-black rounded-sm pl-1">
                <span className="text-xs text-noir-gold-500 font-bold tracking-wide">
                  Created on : {new Date(comment.createdAt).toLocaleDateString("en-US")}
                </span>
                <div className="flex items-center gap-2">
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
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-noir-gold-100 mb-2">
          {t("noComments")}
        </p>
      )}
      <Button
        className="mt-6"
        variant="icon"
        leftIcon={<LuBookPlus size={20} />}
        background="gold"
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
