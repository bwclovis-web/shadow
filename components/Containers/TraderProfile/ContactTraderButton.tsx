import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/Atoms/Button/Button"
import ContactTraderModal from "~/components/Containers/Forms/ContactTraderModal"
import Modal from "~/components/Organisms/Modal/Modal"
import { useSessionStore } from "~/stores/sessionStore"
import { useCSRF } from "~/hooks/useCSRF"
import { getTraderDisplayName } from "~/utils/user"

interface ContactTraderButtonProps {
  traderId: string
  trader: {
    id: string
    firstName?: string | null
    lastName?: string | null
    username?: string | null
    email?: string
  }
  viewerId?: string | null
}

const ContactTraderButton = ({
  traderId,
  trader,
  viewerId,
}: ContactTraderButtonProps) => {
  const { t } = useTranslation()
  const { modalOpen, toggleModal, modalId, closeModal } = useSessionStore()
  const modalTrigger = useRef<HTMLButtonElement>(null)
  const { prepareApiRequest } = useCSRF()

  // Only show button if viewer is authenticated and not viewing their own profile
  if (viewerId === traderId) {
    return null
  }
  
  if (!viewerId) {
    return null
  }

  const traderName = getTraderDisplayName({
    firstName: trader.firstName,
    lastName: trader.lastName,
    email: trader.email || trader.id,
  })
  const [result, setResult] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        className="w-full"
        onClick={() => {
          toggleModal(modalTrigger, "contact-trader", {
            traderId,
            traderName,
          })
        }}
        ref={modalTrigger}
      >
        {t("contactTrader.button", "Contact Trader")}
      </Button>

      {modalOpen && modalId === "contact-trader" && (
        <Modal background="default" innerType="dark" animateStart="top">
          <ContactTraderModal
            recipientId={traderId}
            recipientName={traderName}
            lastResult={result}
            onSubmit={handleSubmit}
            onSuccess={handleSuccess}
          />
        </Modal>
      )}
    </>
  )
}

export default ContactTraderButton



