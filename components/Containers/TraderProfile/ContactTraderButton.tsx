"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import ContactTraderModal from "@/components/Containers/Forms/ContactTraderModal"
import TraderActionButton from "@/components/Containers/TraderProfile/TraderActionButton"
import { useCSRF } from "@/hooks/useCSRF"

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
  const t = useTranslations("contactTrader")
  const { prepareApiRequest } = useCSRF()
  const [result, setResult] = useState<any>(null)
  const [, setIsSubmitting] = useState(false)

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

  return (
    <TraderActionButton
      traderId={traderId}
      trader={trader}
      viewerId={viewerId}
      label={t("button")}
      modalId="contact-trader"
      className="w-full"
      renderModal={({ traderId: recipientId, traderName, closeModal }) => (
        <ContactTraderModal
          recipientId={recipientId}
          recipientName={traderName}
          lastResult={result}
          onSubmit={handleSubmit}
          onSuccess={() => {
            setTimeout(() => closeModal(), 1500)
          }}
        />
      )}
    />
  )
}

export default ContactTraderButton
