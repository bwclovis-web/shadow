import { useState } from "react"
import { useTranslations } from "next-intl"
import type { SubmissionResult } from "@conform-to/react"

import PerfumeForm from "@/components/Containers/Forms/PerfumeForm"
import PerfumeHouseForm from "@/components/Containers/Forms/PerfumeHouseForm"
import Modal from "@/components/Organisms/Modal/Modal"
import { Button } from "@/components/Atoms/Button/Button"
import { useSessionStore } from "@/hooks/sessionStore"
import { useCSRF } from "@/hooks/useCSRF"
import { FORM_TYPES } from "@/constants/general"

/** Normalize API validation errors into conform-to SubmissionResult error shape */
const apiErrorsToConform = (
  errors: Record<string, unknown>
): Record<string, string[]> => {
  const conformErrors: Record<string, string[]> = {}
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages)) {
      conformErrors[field] = messages
    } else if (typeof messages === "string") {
      conformErrors[field] = [messages]
    } else if (messages && typeof messages === "object") {
      conformErrors[field] = (Object.values(messages) as unknown[]).flat().map(String)
    }
  }
  return conformErrors
}

const conformErrorResult = (errors: Record<string, string[]>): SubmissionResult =>
  ({ status: "error", error: errors, initialValue: {} }) as SubmissionResult

const conformSuccessResult = (): SubmissionResult =>
  ({ status: "success", value: {} }) as SubmissionResult

interface PendingSubmissionModalProps {
  submissionType: "perfume" | "perfume_house"
}

const PendingSubmissionModal = ({ submissionType }: PendingSubmissionModalProps) => {
  const { modalOpen, modalId, closeModal } = useSessionStore()
  const t = useTranslations("contactUs.modal")
  const { addToFormData, addToHeaders } = useCSRF()
  const thisModalId = `pending-submission-${submissionType}`
  const section = submissionType === "perfume" ? "perfume" : "house"
  const [lastResult, setLastResult] = useState<SubmissionResult | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (formData: FormData) => {
    formData.append("submissionType", submissionType)
    
    // Reset previous errors
    setServerError(null)
    setSuccessMessage(null)
    setLastResult(null)
    
    // Ensure CSRF token is included
    const protectedFormData = addToFormData(formData)
    const protectedHeaders = addToHeaders({
      "X-Requested-With": "XMLHttpRequest",
    })

    try {
      const response = await fetch("/api/pending-submissions", {
        method: "POST",
        body: protectedFormData,
        headers: protectedHeaders,
      })

      const result = await response.json()

      // Check if response is OK and is JSON
      if (!response.ok) {
        // Handle validation errors (400 status with errors object)
        if (response.status === 400 && result.errors) {
          setLastResult(conformErrorResult(apiErrorsToConform(result.errors)))
          return
        }
        
        // Handle other errors
        setServerError(result.error || `Request failed with status ${response.status}`)
        return
      }

      if (!result.success) {
        setServerError(result.error || "Failed to submit request")
        return
      }

      setSuccessMessage(t("submissionSuccess"))
      setLastResult(conformSuccessResult())

      // Close modal after successful submission
      setTimeout(() => {
        closeModal()
        setLastResult(null)
        setSuccessMessage(null)
      }, 1500)
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Failed to submit request"
      )
    }
  }

  if (!modalOpen || modalId !== thisModalId) {
    return null
  }

  return (
    <Modal className="max-w-4xl" innerType="dark" animateStart="top">
      <div className="p-6 max-h-[50vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-noir-gold mb-4">
          {t(`${section}.title`)}
        </h2>
        <p className="text-noir-light mb-6">
          {t(`${section}.description`)}
        </p>

        {successMessage && (
          <div className="bg-green-500 text-white text-lg font-semibold px-4 py-3 rounded-lg mb-4">
            {successMessage}
          </div>
        )}
        {serverError && (
          <div className="bg-red-500 text-white text-lg font-semibold px-4 py-3 rounded-lg mb-4">
            {serverError}
          </div>
        )}
        {section === "perfume" ? (
          <PerfumeForm
            formType={FORM_TYPES.CREATE_PERFUME_FORM}
            lastResult={lastResult}
            data={null}
            onSubmit={handleSubmit}
            submitButtonText={t("submitButton")}
            className="p-0 border-0 bg-transparent"
            hideImage={true}
            hideNotes={false}
            allowCreateNotes={false}
          />
        ) : (
          <PerfumeHouseForm
            formType={FORM_TYPES.CREATE_HOUSE_FORM}
            lastResult={lastResult}
            data={null}
            onSubmit={handleSubmit}
            submitButtonText={t("submitButton")}
            className="p-0 mt-0 border-0 bg-transparent"
            hideImage={true}
          />
        )}

        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={closeModal}
            className="max-w-max"
          >
            {t("cancelButton")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default PendingSubmissionModal

