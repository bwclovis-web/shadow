"use client"

import Link from "next/link"
import { useRef } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import OpenDisputeModal from "@/components/Containers/Forms/OpenDisputeModal"
import Modal from "@/components/Organisms/Modal/Modal"
import { useSessionStore } from "@/hooks/sessionStore"

type OpenDisputeButtonProps = {
  tradeId: string
  viewerId?: string | null
  hasActiveDispute?: boolean
  userSlug?: string | null
  size?: "sm" | "md"
}

const OpenDisputeButton = ({
  tradeId,
  viewerId,
  hasActiveDispute = false,
  userSlug,
  size = "md",
}: OpenDisputeButtonProps) => {
  const t = useTranslations("dispute")
  const { modalOpen, toggleModal, modalId, closeModal } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)
  const disputeModalId = `open-dispute-${tradeId}`

  if (!viewerId) {
    return null
  }

  if (hasActiveDispute && userSlug) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-noir-gold-100/80">{t("existingDispute")}</span>
        <Link
          href={`/${userSlug}/profile/disputes`}
          className="text-xs text-noir-gold underline hover:text-noir-gold-100"
        >
          {t("viewMyDisputes")}
        </Link>
      </div>
    )
  }

  return (
    <div className="contents">
      <Button
        variant="secondary"
        background="red"
        size={size}
        onClick={() => {
          toggleModal(modalTrigger, disputeModalId, { tradeId })
        }}
        ref={modalTrigger}
      >
        {t("button")}
      </Button>
      {modalOpen && modalId === disputeModalId ? (
        <Modal background="default" innerType="dark" animateStart="top">
          <OpenDisputeModal
            tradeId={tradeId}
            onSuccess={() => {
              setTimeout(() => closeModal(), 1500)
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}

export default OpenDisputeButton
