import { useRef } from "react"
import { useTranslations } from "next-intl"
import { MdDeleteForever } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import { useSessionStore } from "@/hooks/sessionStore"
import type { UserPerfumeI } from "@/types"
import { formatPrice } from "@/utils/numberUtils"

type GeneralDetailsProps = {
  userPerfume: UserPerfumeI
  deletePerfume?: (userPerfumeId: string) => void
  isRemoving?: boolean
  /** Total amount (ml) across all entries for this perfume */
  totalAmount?: number
  /** Amount (ml) remaining after destashes */
  remainingAmount?: number
}

const GeneralDetails = ({
  userPerfume,
  isRemoving = false,
  totalAmount,
  remainingAmount,
}: GeneralDetailsProps) => {
  const t = useTranslations("myScents.listItem")
  const { toggleModal } = useSessionStore()
  const removeButtonRef = useRef<HTMLButtonElement>(null)

  const priceNum = userPerfume.price != null ? Number(userPerfume.price) : null
  const typeLabel =
    getPerfumeTypeLabel(userPerfume.type ?? undefined) ?? "—"

  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-10 mt-6 justify-between md:items-center px-2">
      {userPerfume.placeOfPurchase && (
        <p className="font-medium flex flex-col justify-start items-start">
          <span className="text-lg text-noir-gold">{t("pointOfPurchase")}</span>
          <span className="text-2xl text-noir-gold-100 capitalize">
            {userPerfume.placeOfPurchase}
          </span>
        </p>
      )}
      <div className="flex items-start justify-start gap-8 flex-wrap">
        {typeof totalAmount === "number" && (
          <p className="flex flex-col items-start justify-start">
            <span className="text-lg font-medium text-noir-gold">
              {t("totalAmount")}
            </span>
            <span className="text-2xl text-noir-gold-100">
              {totalAmount.toFixed(1)} ml
            </span>
          </p>
        )}
        {typeof remainingAmount === "number" && (
          <p className="flex flex-col items-start justify-start">
            <span className="text-lg font-medium text-noir-gold">
              {t("remainingAmount")}
            </span>
            <span className="text-2xl text-noir-gold-100">
              {remainingAmount.toFixed(1)} ml
            </span>
          </p>
        )}
        {priceNum != null && !Number.isNaN(priceNum) && (
          <p className="flex flex-col items-start justify-start">
            <span className="text-lg font-medium text-noir-gold">
              {t("price")}
            </span>
            <span className="text-2xl text-noir-gold-100">
              {formatPrice(priceNum)}
            </span>
          </p>
        )}
        <p className="flex flex-col items-start justify-start">
          <span className="text-lg font-medium text-noir-gold">{t("type")}</span>
          <span className="text-2xl text-noir-gold-100">{typeLabel}</span>
        </p>
      </div>
      <Button
        ref={removeButtonRef}
        onClick={() => {
          toggleModal(removeButtonRef, "delete-item")
        }}
        disabled={isRemoving}
        variant="icon"
        background="red"
        size="sm"
        leftIcon={<MdDeleteForever size={20} fill="white" />}
      >
        <span className="text-white/90 font-bold text-sm">
          {isRemoving ? t("removing") : t("removeButton")}
        </span>
      </Button>
    </div>
  )
}

export default GeneralDetails
