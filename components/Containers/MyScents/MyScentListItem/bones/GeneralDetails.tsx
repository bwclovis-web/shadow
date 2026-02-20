import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { MdDeleteForever } from "react-icons/md"
import { useFetcher, useNavigate } from "react-router"
import { Button } from "~/components/Atoms/Button"
import DangerModal from "~/components/Organisms/DangerModal"
import Modal from "~/components/Organisms/Modal"

import { getPerfumeTypeLabel } from "~/data/SelectTypes"
import { useSessionStore } from "~/stores/sessionStore"
import { formatPrice } from "~/utils/numberUtils"

const GeneralDetails = ({ userPerfume }: { userPerfume: any }) => {
  const { t } = useTranslation()
  const { modalOpen, toggleModal, modalId, closeModal } = useSessionStore()
  const navigate = useNavigate()
  const removeButtonRef = useRef<HTMLButtonElement>(null)
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state === "submitting"


  return (
    <>
    <div className="flex flex-col md:flex-row gap-2 md:gap-10 mt-6 justify-between md:items-center px-2">
      {userPerfume.placeOfPurchase && (
        <p className="font-medium flex flex-col justify-start items-start">
          <span className="text-lg text-noir-gold">{t("myScents.listItem.pointOfPurchase")}</span>
          <span className="text-2xl text-noir-gold-100 capitalize">
            {userPerfume.placeOfPurchase}
          </span>
        </p>
      )}
      <div className="flex items-start justify-start gap-8">
        {userPerfume.price && (
          <p className="flex flex-col items-start justify-start">
            <span className="text-lg font-medium text-noir-gold">
              {t("myScents.listItem.price")}
            </span>
            <span className="text-2xl text-noir-gold-100">
              {formatPrice(userPerfume.price)}
            </span>
          </p>
        )}
        <p className="flex flex-col items-start justify-start">
          <span className="text-lg font-medium text-noir-gold">{t("myScents.listItem.type")}</span>
          <span className="text-2xl text-noir-gold-100">
            {getPerfumeTypeLabel(userPerfume.type)}
          </span>
        </p>
      </div>
      <Button
        ref={removeButtonRef}
        onClick={() => {
          toggleModal(removeButtonRef, "delete-item")
        }}
        disabled={isSubmitting}
        variant="icon"
        background="red"
        size="sm"
        leftIcon={<MdDeleteForever size={20} fill="white" />}
      >
        <span className="text-white/90 font-bold text-sm">
          {isSubmitting
            ? t("myScents.listItem.removing")
            : t("myScents.listItem.removeButton")}
        </span>
      </Button>
    </div>
    </>
  )
}

export default GeneralDetails
