"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import type { SubmissionResult } from "@conform-to/react"

import {
  submitPendingHouseFromContactAction,
  submitPendingPerfumeFromContactAction,
  type ContactPendingActionState,
  type ContactPendingFatal,
} from "@/app/contact-us/actions"
import PerfumeForm from "@/components/Containers/Forms/PerfumeForm"
import PerfumeHouseForm from "@/components/Containers/Forms/PerfumeHouseForm"
import { Button } from "@/components/Atoms/Button/Button"
import Modal from "@/components/Organisms/Modal/Modal"
import { FORM_TYPES } from "@/constants/general"
import { useSessionStore } from "@/hooks/sessionStore"

const isFatal = (s: ContactPendingActionState): s is ContactPendingFatal =>
  s != null && typeof s === "object" && "_fatal" in s && (s as ContactPendingFatal)._fatal === true

type InnerProps = {
  submissionType: "perfume" | "perfume_house"
  closeModal: () => void
}

const PendingSubmissionModalInner = ({ submissionType, closeModal }: InnerProps) => {
  const t = useTranslations("contactUs.modal")
  const section = submissionType === "perfume" ? "perfume" : "house"

  const [state, formAction] = useActionState(
    submissionType === "perfume"
      ? submitPendingPerfumeFromContactAction
      : submitPendingHouseFromContactAction,
    null as ContactPendingActionState
  )

  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const lastResult: SubmissionResult | null =
    state && !isFatal(state) ? (state as SubmissionResult) : null

  useEffect(() => {
    if (!state) return
    if (isFatal(state)) {
      setServerError(state.message)
      return
    }
    if (state.status === "success") {
      setServerError(null)
      setSuccessMessage(t("submissionSuccess"))
      const tmr = window.setTimeout(() => {
        closeModal()
        setSuccessMessage(null)
      }, 1500)
      return () => window.clearTimeout(tmr)
    }
  }, [state, closeModal, t])

  return (
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
          action={formAction}
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
          action={formAction}
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
  )
}

interface PendingSubmissionModalProps {
  submissionType: "perfume" | "perfume_house"
}

const PendingSubmissionModal = ({ submissionType }: PendingSubmissionModalProps) => {
  const { modalOpen, modalId, closeModal } = useSessionStore()
  const thisModalId = `pending-submission-${submissionType}`
  const [innerKey, setInnerKey] = useState(0)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    const isOpen = modalOpen && modalId === thisModalId
    if (isOpen && !wasOpenRef.current) {
      setInnerKey((k) => k + 1)
    }
    wasOpenRef.current = isOpen
  }, [modalOpen, modalId, thisModalId])

  if (!modalOpen || modalId !== thisModalId) {
    return null
  }

  return (
    <Modal className="max-w-4xl" innerType="dark" animateStart="top">
      <PendingSubmissionModalInner
        key={innerKey}
        submissionType={submissionType}
        closeModal={closeModal}
      />
    </Modal>
  )
}

export default PendingSubmissionModal
