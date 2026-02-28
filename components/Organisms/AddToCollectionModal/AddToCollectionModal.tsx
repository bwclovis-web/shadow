import { cx } from "class-variance-authority"
import { useRef } from "react"
import { useTranslations } from "next-intl"
import { MdLibraryAdd } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import MyScentsModal from "@/components/Containers/MyScents/MyScentsModal"
import { useSessionStore } from "@/hooks/sessionStore"
import type { PerfumeI } from "@/types"

import Modal from "../Modal/Modal"

interface AddToCollectionModalProps {
  type?: "icon" | "primary"
  perfume?: PerfumeI
  className?: string
  /** Called after a perfume is successfully added to the collection (e.g. to refresh the list). */
  onAddedToCollection?: () => void
}

const AddToCollectionModal = ({
  type,
  perfume,
  className,
  onAddedToCollection,
}: AddToCollectionModalProps) => {
  const { modalOpen, toggleModal, modalId } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)
  const t = useTranslations("myScents")
  const isIcon = type === "icon"

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
            <span className="text-sm">{t("addButton")}</span>
            <MdLibraryAdd size={20} />
          </div>
        ) : (
          <p>{t("addButton")}</p>
        )}
      </Button>

      {modalOpen && modalId === "add-scent" && (
        <Modal innerType="dark" id="add-scent" animateStart="top">
          <MyScentsModal perfume={perfume} onAddedToCollection={onAddedToCollection} />
        </Modal>
      )}
    </>
  )
}
export default AddToCollectionModal
