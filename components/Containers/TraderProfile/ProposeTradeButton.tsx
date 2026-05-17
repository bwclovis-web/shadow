"use client"

import { useRef } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { TradeComposerModal } from "@/components/Containers/Trade/TradeComposerModal"
import Modal from "@/components/Organisms/Modal/Modal"
import { tradeComposerModalId } from "@/constants/modalIds"
import { useSessionStore } from "@/hooks/sessionStore"
import { getTradeCtaLabelKey, tradeListingSeedFromUserPerfumeI } from "@/types/trade"
import type { UserPerfumeI } from "@/types"
import { getTraderDisplayName } from "@/utils/user"

type ProposeTradeButtonProps = {
  traderId: string
  trader: {
    id: string
    firstName?: string | null
    lastName?: string | null
    username?: string | null
    email?: string
  }
  userPerfume: UserPerfumeI
  viewerId?: string | null
}

const ProposeTradeButton = ({
  traderId,
  trader,
  userPerfume,
  viewerId,
}: ProposeTradeButtonProps) => {
  const t = useTranslations("tradeComposer")
  const { modalOpen, toggleModal, closeModal, modalId, modalData } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)

  if (viewerId === traderId || !viewerId) return null

  const traderName = getTraderDisplayName({
    firstName: trader.firstName,
    lastName: trader.lastName,
    email: trader.email || trader.id,
  })

  const itemModalId = tradeComposerModalId(userPerfume.id)
  const seed = tradeListingSeedFromUserPerfumeI(userPerfume, traderId)
  const ctaKey = getTradeCtaLabelKey(userPerfume.tradePreference, userPerfume.tradeOnly)

  return (
    <>
      <Button
        variant="primary"
        background="gold"
        size="sm"
        className="mt-2 w-full max-w-max"
        onClick={() => {
          toggleModal(modalTrigger, itemModalId, {
            mode: "compose",
            init: { seed, counterpartyDisplayName: traderName },
          })
        }}
        ref={modalTrigger}
      >
        {t(ctaKey)}
      </Button>

      {modalOpen && modalId === itemModalId && modalData?.mode === "compose" ? (
        <Modal animateStart="top" innerType="dark">
          <TradeComposerModal
            data={modalData as { mode: "compose"; init: { seed: typeof seed; counterpartyDisplayName: string } }}
            onClose={closeModal}
          />
        </Modal>
      ) : null}
    </>
  )
}

export default ProposeTradeButton
