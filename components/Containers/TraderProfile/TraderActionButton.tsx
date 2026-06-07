"use client"

import { type ReactNode, useRef } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import Modal from "@/components/Organisms/Modal/Modal"
import { useSessionStore } from "@/hooks/sessionStore"
import { getTraderDisplayName } from "@/utils/user"

export type TraderProfileRef = {
  id: string
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  email?: string
}

type TraderActionButtonProps = {
  traderId: string
  trader: TraderProfileRef
  viewerId?: string | null
  label: string
  modalId: string
  modalData?: Record<string, unknown>
  variant?: "primary" | "secondary"
  background?: "gold" | "red"
  size?: "sm" | "md"
  className?: string
  wrapperClassName?: string
  modalBackground?: "default" | "light" | "purple"
  renderModal: (props: {
    traderId: string
    traderName: string
    closeModal: () => void
  }) => ReactNode
  onBeforeOpen?: (traderName: string) => Record<string, unknown> | void
}

export const TraderActionButton = ({
  traderId,
  trader,
  viewerId,
  label,
  modalId,
  modalData,
  variant = "primary",
  background = "gold",
  size = "md",
  className,
  wrapperClassName = "",
  modalBackground = "default",
  renderModal,
  onBeforeOpen,
}: TraderActionButtonProps) => {
  const { modalOpen, toggleModal, modalId: activeModalId, closeModal } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)

  if (viewerId === traderId || !viewerId) {
    return null
  }

  const traderName = getTraderDisplayName(trader)

  const handleClick = () => {
    const extraData = onBeforeOpen?.(traderName)
    toggleModal(modalTrigger, modalId, {
      traderId,
      traderName,
      ...modalData,
      ...extraData,
    })
  }

  const isOpen = modalOpen && activeModalId === modalId

  return (
    <div className={wrapperClassName || "contents"}>
      <Button
        variant={variant}
        background={background}
        size={size}
        className={className}
        onClick={handleClick}
        ref={modalTrigger}
      >
        {label}
      </Button>

      {isOpen ? (
        <Modal background={modalBackground} innerType="dark" animateStart="top">
          {renderModal({ traderId, traderName, closeModal })}
        </Modal>
      ) : null}
    </div>
  )
}

export default TraderActionButton
