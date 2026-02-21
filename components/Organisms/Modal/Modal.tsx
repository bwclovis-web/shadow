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
import { styleMerge } from "@/utils/styleUtils"

import { modalBackgroundVariant, modalContentVariant } from "./modal-variants"

const CLOSE_DELAY_MS = 60
const ANIMATE_DELAY_MS = 140

interface ModalProps
  extends HTMLProps<HTMLDivElement>,
    VariantProps<typeof modalBackgroundVariant>,
    VariantProps<typeof modalContentVariant> {
  children: ReactNode
}

const Modal = ({
  children,
  background,
  innerType,
  animateStart,
  ref,
}: ModalProps) => {
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { closeModal, modalOpen } = useSessionStore()

  const handleClose = () => {
    setAnimate(false)
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(closeModal, CLOSE_DELAY_MS)
  }

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
      className="fixed inset-0 z-9999 flex justify-center items-center isolate"
      style={{ willChange: "opacity" }}
    >
      {modalOpen && (
        <div
          className={styleMerge(modalBackgroundVariant({
              animate,
              animateStart,
              background,
            }))}
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
        className={styleMerge(modalContentVariant({
            animate,
            animateStart,
            innerType,
          }))}
        style={{ willChange: "transform, opacity" }}
      >
        <button
          type="button"
          className="absolute top-5 right-5 max-w-max cursor-pointer z-20"
          onClick={handleClose}
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

  return mounted
    ? createPortal(template, document.querySelector("#modal-portal") as Element)
    : null
}

export default Modal
