import { cx } from "class-variance-authority"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { MdLibraryAdd } from "react-icons/md"

import { Button } from "~/components/Atoms/Button"
import MyScentsModal from "~/components/Containers/MyScents/MyScentsModal"
import { useSessionStore } from "~/stores/sessionStore"
import type { PerfumeI } from "~/types"

import Modal from "../Modal/Modal"

interface AddToCollectionModalProps {
  type?: "icon" | "primary"
  perfume?: PerfumeI
  className?: string
}

const AddToCollectionModal = ({
  type,
  perfume,
  className,
}: AddToCollectionModalProps) => {
  const { modalOpen, toggleModal, modalId } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)
  const { t } = useTranslation()
  const ButtonClasses = cx({
    [`z-50 ${className}`]: true,
  })
  return (
    <>
      <div>
        <Button
          background={type === "icon" ? "gold" : undefined}
          variant={type}
          className={ButtonClasses}
          onClick={() => {
            toggleModal(modalTrigger, "add-scent", "create")
          }}
          ref={modalTrigger}
        >
          {type === "icon" ? (
            <div className="flex items-center justify-between gap-2">
              <span className=" text-sm">{t("myScents.addButton")}</span>
              <MdLibraryAdd size={20} />
            </div>
          ) : (
            <p>{t("myScents.addButton")}</p>
          )}
        </Button>
      </div>

      {modalOpen && modalId === "add-scent" && (
        <Modal innerType="dark" id="add-scent" animateStart="top">
          <MyScentsModal perfume={perfume} />
        </Modal>
      )}
    </>
  )
}
export default AddToCollectionModal
