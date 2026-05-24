import { cx } from "class-variance-authority"
import { useRef } from "react"
import { useTranslations } from "next-intl"
import { MdLibraryAdd } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import MyScentsModal from "@/components/Containers/MyScents/MyScentsModal"
import { useSessionStore } from "@/hooks/sessionStore"
import type { OptimisticCollectionItem } from "@/hooks/useMyScentsForm"
import type { PerfumeI } from "@/types"

import Modal from "../Modal/Modal"

interface AddToCollectionModalProps {
  type?: "icon" | "primary"
  perfume?: PerfumeI
  className?: string
  /** Called after a perfume is successfully added to the collection (e.g. to refresh the list). */
  onAddedToCollection?: () => void
  /** Called immediately to show an optimistic perfume entry. */
  onOptimisticAddToCollection?: (item: OptimisticCollectionItem) => void
  /** Called when optimistic add should be rolled back. */
  onOptimisticAddRollback?: (tempId: string) => void
  autoFocusSearch?: boolean
  /** On a single-scent page, label the trigger as adding another bottle of the same fragrance. */
  addAnotherBottle?: boolean
}

const AddToCollectionModal = ({
  type,
  perfume,
  className,
  onAddedToCollection,
  onOptimisticAddToCollection,
  onOptimisticAddRollback,
  autoFocusSearch = false,
  addAnotherBottle = false,
}: AddToCollectionModalProps) => {
  const { modalOpen, toggleModal, modalId } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)
  const t = useTranslations("myScents")
  const isIcon = type === "icon"
  const buttonLabel = addAnotherBottle ? t("addAnotherBottleButton") : t("addButton")

  return (
    <>
      <Button
        background={isIcon ? "gold" : undefined}
        variant={type}
        className={cx("z-50", className)}
        onClick={() => toggleModal(modalTrigger, "add-scent", { action: "create" })}
        ref={modalTrigger}
      >
        {isIcon ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">{buttonLabel}</span>
            <MdLibraryAdd size={20} />
          </div>
        ) : (
          <span>{buttonLabel}</span>
        )}
      </Button>

      {modalOpen && modalId === "add-scent" && (
        <Modal innerType="dark" id="add-scent" animateStart="top">
          <MyScentsModal
            perfume={perfume as unknown as import("@/types").UserPerfumeI}
            onAddedToCollection={onAddedToCollection}
            onOptimisticAddToCollection={onOptimisticAddToCollection}
            onOptimisticAddRollback={onOptimisticAddRollback}
            autoFocusSearch={autoFocusSearch}
          />
        </Modal>
      )}
    </>
  )
}
export default AddToCollectionModal
