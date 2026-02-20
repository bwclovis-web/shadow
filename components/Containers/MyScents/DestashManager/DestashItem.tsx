import { useTranslation } from "react-i18next"
import { MdDelete, MdDeleteForever, MdEdit } from "react-icons/md"

import { Button } from "~/components/Atoms/Button"
import VooDooCheck from "~/components/Atoms/VooDooCheck/VooDooCheck"
import CommentsModal from "~/components/Containers/MyScents/CommentsModal"
import DangerModal from "~/components/Organisms/DangerModal"
import Modal from "~/components/Organisms/Modal"
import { usePerfumeComments } from "~/hooks/usePerfumeComments"
import { useSessionStore } from "~/stores/sessionStore"
import type { UserPerfumeI } from "~/types"

interface DestashItemProps {
  destash: UserPerfumeI
  onEdit: () => void
  onDelete: () => void
}

const DestashItem = ({ destash, onEdit, onDelete }: DestashItemProps) => {
  const { t } = useTranslation()
  const { modalOpen, toggleModal, modalId } = useSessionStore()
  const { uniqueModalId, addComment, comments, toggleCommentVisibility, deleteComment } = usePerfumeComments({ userPerfume: destash })

  const getTradePreferenceLabel = (preference: "cash" | "trade" | "both") => {
    switch (preference) {
      case "cash":
        return t("myScents.listItem.decantOptionsTradePreferencesCash")
      case "trade":
        return t("myScents.listItem.decantOptionsTradePreferencesTrade")
      case "both":
        return t("myScents.listItem.decantOptionsTradePreferencesBoth")
      default:
        return preference
    }
  }


  return (
    <>
      {modalOpen && modalId === "delete-destash-item" && (
        <Modal innerType="dark" animateStart="top">
          <DangerModal
            heading="Are you sure you want to delete this destash?"
            description="Once deleted, it will be removed from the exchange and your trader profile."
            action={onDelete}
          />
        </Modal>
      )}
      {modalOpen && modalId === uniqueModalId && (
        <Modal innerType="dark" animateStart="top">
          <CommentsModal perfume={destash} addComment={addComment} />
        </Modal>
      )}
      <div className="noir-border bg-noir-dark/90">
        <div className="p-4 flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-noir-gold-500 font-medium">
                {t("myScents.destashManager.amount")}
              </p>
              <p className="text-lg text-noir-gold-100">
                {destash.available} ml
              </p>
            </div>
            {destash.tradePrice && (
              <div>
                <p className="text-sm text-noir-gold-500 font-medium">
                  {t("myScents.destashManager.price")}
                </p>
                <p className="text-lg text-noir-gold-100">
                  ${destash.tradePrice}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-noir-gold-500 font-medium">
                {t("myScents.destashManager.tradePreference")}
              </p>
              <p className="text-lg text-noir-gold-100">
                {getTradePreferenceLabel(destash.tradePreference as "cash" | "trade" | "both")}
              </p>
            </div>
            {destash.tradeOnly && (
              <div>
                <p className="text-sm text-noir-gold-500 font-medium">
                  {t("myScents.destashManager.tradeOnly")}
                </p>
                <p className="text-lg text-noir-gold-100">
                  {t("myScents.destashManager.yes")}
                </p>
              </div>
            )}
          </div>
          <div className="w-full md:w-auto flex flex-col md:flex-row gap-2">
            <Button
              onClick={() => {
                const buttonRef = { current: document.createElement("button") }
                toggleModal(buttonRef as any, uniqueModalId, { action: "create" })
              }}
              variant="primary"
              size="sm"
              className="w-full md:w-auto"
            >
              {t("myScents.comments.addCommentButton", "Add Comment")}
            </Button>
            <Button
              onClick={onEdit}
              variant="secondary"
              size="sm"
              leftIcon={<MdEdit size={16} />}
              className="w-full md:w-auto flex items-center justify-between gap-2"
            >
              {t("myScents.destashManager.edit")}
            </Button>
            <Button
              onClick={() => {
                const buttonRef = { current: document.createElement("button") }
                toggleModal(buttonRef as any, "delete-destash-item")
              }}
              variant="icon"
              size="sm"
              background="red"
              leftIcon={<MdDelete size={16} />}
              className="w-full md:w-auto"
            >
              {t("myScents.destashManager.delete")}
            </Button>
          </div>
        </div>
        
        {/* Comments section for this destash */}
        {comments.length > 0 && (
          <div className="border-t border-noir-gold/20 p-4 bg-noir-black/30">
            <h4 className="text-sm font-semibold text-noir-gold-300 mb-2">
              {t("myScents.comments.heading", "Comments")} ({comments.length})
            </h4>
            <div className="space-y-2">
              {comments.map(comment => (
                <div key={comment.id} className="p-3 bg-noir-dark/50 rounded border border-noir-gold/10">
                  <p className="text-base text-noir-gold-100 mb-2">{comment.comment}</p>
                  <div className="flex items-center justify-between mt-2 bg-noir-black rounded-sm pl-1">
                    <span className="text-xs text-noir-gold-500 font-bold tracking-wide">
                      Created on: {new Date(comment.createdAt).toLocaleDateString("en-US")}
                    </span>
                    <div className="flex items-center gap-2">
                      <VooDooCheck
                        checked={comment.isPublic}
                        labelChecked={t("myScents.comments.makePublic", "Make this comment public")}
                        labelUnchecked={t("myScents.comments.makePrivate", "Make this comment private")}
                        onChange={() => toggleCommentVisibility(comment.id, comment.isPublic)}
                      />
                      <Button
                        variant="icon"
                        onClick={() => deleteComment(comment.id)}
                        background={"red"}
                        className="flex"
                      >
                        <span className="text-white/90 font-bold text-sm">
                          {t("myScents.comments.deleteComment")}
                        </span>
                        <MdDeleteForever size={20} fill="white" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default DestashItem
