import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { SubmissionResult } from "@conform-to/react"

import PerfumeForm from "~/components/Containers/Forms/PerfumeForm"
import PerfumeHouseForm from "~/components/Containers/Forms/PerfumeHouseForm"
import Modal from "~/components/Organisms/Modal/Modal"
import { Button } from "~/components/Atoms/Button/Button"
import { useSessionStore } from "~/stores/sessionStore"
import { useCSRF } from "~/hooks/useCSRF"
import { FORM_TYPES } from "~/utils/constants"

interface PendingSubmissionModalProps {
  submissionType: "perfume" | "perfume_house"
}

const PendingSubmissionModal = ({ submissionType }: PendingSubmissionModalProps) => {
  const { modalOpen, modalId, closeModal } = useSessionStore()
  const { t } = useTranslation()
  const { addToFormData, addToHeaders } = useCSRF()
  const MODAL_ID = `pending-submission-${submissionType}`
  const isPerfume = submissionType === "perfume"
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
          // Convert API errors to conform-to format
          // conform-to expects errors in format: { fieldName: ["error message"] }
          const conformErrors: Record<string, string[]> = {}
          for (const [field, messages] of Object.entries(result.errors)) {
            if (Array.isArray(messages)) {
              conformErrors[field] = messages
            } else if (typeof messages === "string") {
              conformErrors[field] = [messages]
            } else if (messages && typeof messages === "object") {
              // Handle nested error objects
              const errorArray = Object.values(messages).flat()
              conformErrors[field] = errorArray.map(String)
            }
          }
          
          // Create a SubmissionResult that conform-to can use
          // conform-to expects: { status: "error", error: { field: ["message"] } }
          setLastResult({
            status: "error" as const,
            error: conformErrors,
            initialValue: {},
          } as SubmissionResult)
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

      // Success!
      setSuccessMessage(t("contactUs.submissionModal.successMessage"))
      // Set success result in conform-to format
      setLastResult({
        status: "success" as const,
        value: {},
      } as SubmissionResult)

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

  if (!modalOpen || modalId !== MODAL_ID) {
    return null
  }

  return (
    <Modal className="max-w-4xl" innerType="dark" animateStart="top">
      <div className="p-6 max-h-[50vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-noir-gold mb-4">
          {isPerfume
            ? t("contactUs.modal.perfume.title")
            : t("contactUs.modal.house.title")}
        </h2>
        <p className="text-noir-light mb-6">
          {isPerfume
            ? t("contactUs.modal.perfume.description")
            : t("contactUs.modal.house.description")}
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
        {isPerfume ? (
          <PerfumeForm
            formType={FORM_TYPES.CREATE_PERFUME_FORM}
            lastResult={lastResult}
            data={null}
            onSubmit={handleSubmit}
            submitButtonText={t("contactUs.modal.submitButton")}
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
            submitButtonText={t("contactUs.modal.submitButton")}
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
            {t("contactUs.modal.cancelButton")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default PendingSubmissionModal

