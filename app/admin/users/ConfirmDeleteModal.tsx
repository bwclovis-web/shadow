"use client"

import { createPortal } from "react-dom"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { IoMdCloseCircle } from "react-icons/io"

const ConfirmDeleteModal = ({
  isOpen,
  deleteType,
  isSubmitting,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  deleteType: "delete" | "soft-delete"
  isSubmitting: boolean
  onConfirm: () => void
  onCancel: () => void
}) => {
  const [mounted, setMounted] = useState(false)
  const tTable = useTranslations("userAdmin.table")
  const t = useTranslations("userAdmin")

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

  const title =
    deleteType === "delete"
      ? tTable("delete")
      : tTable("softDelete")
  const description =
    deleteType === "delete"
      ? t("confirmDeleteDescription")
      : t("confirmSoftDeleteDescription")

  const template = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center isolate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
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
          id="confirm-delete-title"
          className="mb-2 text-lg font-semibold text-noir-gold-100"
        >
          {title}
        </h2>
        <p className="mb-6 text-sm text-noir-gold-100/90">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded border border-noir-gold px-4 py-2 text-noir-gold-100 hover:bg-noir-gold/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="delete-form"
            disabled={isSubmitting}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? "Processing…" : "Confirm"}
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

export default ConfirmDeleteModal
