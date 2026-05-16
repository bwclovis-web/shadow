import { type VariantProps } from "class-variance-authority"
import {
  type HTMLProps,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { IoMdCloseCircle } from "react-icons/io"

import { useSessionStore } from "@/hooks/sessionStore"
import { useFocusTrap } from "@/hooks/useFocusTrap"
import { styleMerge } from "@/utils/styleUtils"

import { modalBackgroundVariant, modalContentVariant } from "./modal-variants"

const CLOSE_DELAY_MS = 60
const ANIMATE_DELAY_MS = 140

interface ModalProps
  extends HTMLProps<HTMLDivElement>,
    VariantProps<typeof modalBackgroundVariant>,
    VariantProps<typeof modalContentVariant> {
  children: ReactNode
  /** Optional `id` of a visible heading inside the modal for `aria-labelledby`. */
  dialogAriaLabelledBy?: string
  /** Used when `dialogAriaLabelledBy` is not set. Defaults to `"Dialog"`. */
  dialogAriaLabel?: string
  /** Called when the modal begins closing (X, backdrop, or Escape). */
  onClose?: () => void
}

const Modal = ({
  children,
  background,
  innerType,
  animateStart,
  ref,
  dialogAriaLabelledBy,
  dialogAriaLabel,
  className,
  onClose,
}: ModalProps) => {
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { closeModal, modalOpen } = useSessionStore()

  const handleClose = () => {
    setAnimate(false)
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => {
      onClose?.()
      closeModal()
    }, CLOSE_DELAY_MS)
  }

  useFocusTrap(modalRef, {
    active: modalOpen,
    onEscape: handleClose,
  })

  useLayoutEffect(() => {
    setMounted(true)
    return () => {
      setMounted(false)
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      const timeoutId = setTimeout(() => setAnimate(true), ANIMATE_DELAY_MS)
      return () => clearTimeout(timeoutId)
    }
  }, [mounted])

  const template = (
    <div
      ref={ref}
      id="modalContainer"
      className="fixed inset-0 z-9999 flex items-center justify-center isolate p-4 sm:p-6"
      style={{ willChange: "opacity" }}
    >
      {modalOpen && (
        <div
          className={styleMerge(
            modalBackgroundVariant({
              animate,
              background,
            })
          )}
          tabIndex={0}
          role="button"
          onClick={handleClose}
          onKeyDown={evt => {
            if (evt.key === "Enter" || evt.key === " ") {
              evt.preventDefault()
              handleClose()
            }
          }}
          style={{ willChange: "opacity" }}
        />
      )}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogAriaLabelledBy}
        aria-label={
          dialogAriaLabelledBy ? undefined : (dialogAriaLabel ?? "Dialog")
        }
        className={styleMerge(
          modalContentVariant({
            animate,
            animateStart,
            innerType,
          }),
          className
        )}
        style={{ willChange: "transform, opacity" }}
      >
        <button
          type="button"
          className="absolute top-5 right-5 max-w-max cursor-pointer z-20"
          onClick={handleClose}
          aria-label="Close modal"
        >
          <IoMdCloseCircle
            size={34}
            color="currentColor"
            className="fill-noir-blue"
          />
        </button>
        {children}
      </div>
    </div>
  )

  const portalRoot =
    typeof document !== "undefined"
      ? (document.querySelector("#modal-portal") ?? document.body)
      : null

  return mounted && portalRoot ? createPortal(template, portalRoot) : null
}

export default Modal
