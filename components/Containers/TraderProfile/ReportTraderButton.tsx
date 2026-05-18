"use client"

import { useRef } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import ReportTraderModal from "@/components/Containers/Forms/ReportTraderModal"
import Modal from "@/components/Organisms/Modal/Modal"
import { useSessionStore } from "@/hooks/sessionStore"
import { getTraderDisplayName } from "@/utils/user"

type ReportTraderButtonProps = {
  traderId: string
  trader: {
    id: string
    firstName?: string | null
    lastName?: string | null
    username?: string | null
    email?: string
  }
  viewerId?: string | null
  tradeId?: string | null
  size?: "sm" | "md"
}

const ReportTraderButton = ({
  traderId,
  trader,
  viewerId,
  tradeId,
  size = "md",
}: ReportTraderButtonProps) => {
  const t = useTranslations("userReport")
  const { modalOpen, toggleModal, modalId, closeModal } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)

  if (viewerId === traderId || !viewerId) {
    return null
  }

  const traderName = getTraderDisplayName(trader)
  const reportModalId = tradeId ? `report-trader-${tradeId}` : "report-trader"

  return (
    <>
      <Button
        variant="secondary"
        background="red"
        size={size}
        onClick={() => {
          toggleModal(modalTrigger, reportModalId, { traderId, traderName })
        }}
        ref={modalTrigger}
      >
        {t("button")}
      </Button>

      {modalOpen && modalId === reportModalId && (
        <Modal background="default" innerType="dark" animateStart="top">
          <ReportTraderModal
            reportedUserId={traderId}
            traderName={traderName}
            tradeId={tradeId}
            onSuccess={() => {
              setTimeout(() => closeModal(), 1500)
            }}
          />
        </Modal>
      )}
    </>
  )
}

export default ReportTraderButton
