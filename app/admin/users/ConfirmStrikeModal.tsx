"use client"

import { createPortal } from "react-dom"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { IoMdCloseCircle } from "react-icons/io"

const ConfirmStrikeModal = ({
  isOpen,
  isSubmitting,
  onCancel,
  formId = "strike-form",
  defaultReason = "",
}: {
  isOpen: boolean
  isSubmitting: boolean
  onCancel: () => void
  formId?: string
  defaultReason?: string
}) => {
  const [mounted, setMounted] = useState(false)
  const t = useTranslations("userAdmin.strikeModal")

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) onCancel()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, isSubmitting, onCancel])

  if (!mounted || !isOpen) return null

  const template = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center isolate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-strike-title"
    >
      <div
        className="absolute inset-0 bg-black/70"
        onClick={isSubmitting ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-noir-gold bg-noir-dark p-6 shadow-xl">
        <button
          type="button"
          className="absolute right-3 top-3 text-noir-gold hover:opacity-80"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label="Close"
        >
          <IoMdCloseCircle size={28} />
        </button>
        <h2
          id="confirm-strike-title"
          className="mb-2 text-lg font-semibold text-noir-gold-100"
        >
          {t("title")}
        </h2>
        <p className="mb-4 text-sm text-noir-gold-100/90">{t("description")}</p>
        <label htmlFor="strike-reason" className="mb-1 block text-sm text-noir-gold-100">
          {t("reasonLabel")}
        </label>
        <textarea
          key={`${formId}-${defaultReason}`}
          id="strike-reason"
          name="reason"
          form={formId}
          required
          rows={3}
          disabled={isSubmitting}
          defaultValue={defaultReason}
          className="mb-6 w-full rounded border border-noir-gold-500/50 bg-noir-black px-3 py-2 text-sm text-noir-gold-100 focus:border-noir-gold focus:outline-none focus:ring-1 focus:ring-noir-gold disabled:opacity-50"
          placeholder={t("reasonPlaceholder")}
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded border border-noir-gold px-4 py-2 text-noir-gold-100 hover:bg-noir-gold/10 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isSubmitting ? t("processing") : t("confirm")}
          </button>
        </div>
      </div>
    </div>
  )

  const portalRoot =
    typeof document !== "undefined"
      ? document.querySelector("#modal-portal") ?? document.body
      : null

  return portalRoot ? createPortal(template, portalRoot) : null
}

export default ConfirmStrikeModal
