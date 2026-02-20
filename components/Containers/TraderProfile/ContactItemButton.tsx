import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/Atoms/Button/Button"
import ContactTraderModal from "~/components/Containers/Forms/ContactTraderModal"
import Modal from "~/components/Organisms/Modal/Modal"
import { useSessionStore } from "~/stores/sessionStore"
import { useCSRF } from "~/hooks/useCSRF"
import { getTraderDisplayName } from "~/utils/user"
import type { UserPerfumeI } from "~/types"

interface ContactItemButtonProps {
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

const ContactItemButton = ({
  traderId,
  trader,
  userPerfume,
  viewerId,
}: ContactItemButtonProps) => {
  const { t } = useTranslation()
  const { modalOpen, toggleModal, modalId, closeModal } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)
  const { prepareApiRequest } = useCSRF()

  if (viewerId === traderId || !viewerId) {
    return null
  }

  const traderName = getTraderDisplayName({
    firstName: trader.firstName,
    lastName: trader.lastName,
    email: trader.email || trader.id,
  })
  const [result, setResult] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Generate item-specific modal ID to allow multiple item modals
  const itemModalId = `contact-item-${userPerfume.id}`

  // Create item information for the form
  const itemInfo = {
    userPerfumeId: userPerfume.id,
    perfumeName: userPerfume.perfume?.name || "Unknown Perfume",
    perfumeHouse: userPerfume.perfume?.perfumeHouse?.name || "",
    amount: userPerfume.available || "0",
    price: userPerfume.price,
    tradePrice: userPerfume.tradePrice,
    tradePreference: userPerfume.tradePreference,
  }

  // Generate a pre-filled subject line
  const itemSubject = t("contactTrader.itemSubject", {
    perfumeName: itemInfo.perfumeName,
    perfumeHouse: itemInfo.perfumeHouse ? ` by ${itemInfo.perfumeHouse}` : "",
  }) || `Inquiry about ${itemInfo.perfumeName}${itemInfo.perfumeHouse ? ` by ${itemInfo.perfumeHouse}` : ""}`

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true)
    
    const { formData: protectedFormData, headers } = prepareApiRequest(formData)
    
    try {
      const response = await fetch("/api/contact-trader", {
        method: "POST",
        headers: headers,
        body: protectedFormData,
        credentials: "include",
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send message",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSuccess = () => {
    // Close modal after successful submission
    setTimeout(() => {
      closeModal()
    }, 1500)
  }

  return (
    <>
      <Button
        variant="primary"
        background="gold"
        size="sm"
        className="mt-2 w-full"
        onClick={() => {
          toggleModal(modalTrigger, itemModalId, {
            traderId,
            traderName,
            itemInfo,
            itemSubject,
          })
        }}
        ref={modalTrigger}
      >
        {t("contactTrader.inquireButton", "Inquire About This Item")}
      </Button>

      {modalOpen && modalId === itemModalId && (
        <Modal animateStart="top" innerType="dark">
          <ContactTraderModal
            recipientId={traderId}
            recipientName={traderName}
            lastResult={result}
            onSubmit={handleSubmit}
            onSuccess={handleSuccess}
            itemInfo={itemInfo}
            itemSubject={itemSubject}
          />
        </Modal>
      )}
    </>
  )
}

export default ContactItemButton



