"use client"

import { type ReactNode, useId, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { FiX } from "react-icons/fi"

import { Button } from "@/components/Atoms/Button/Button"
import { useFocusTrap } from "@/hooks/useFocusTrap"

export type CatalogFilterDrawerProps = {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  clearLabel: string
  applyLabel: string
  onClear: () => void
  onApply: () => void
  children: ReactNode
}

/**
 * Bottom sheet below `md`, right-hand panel from `md`. Changes stay in the
 * caller's draft state until Apply.
 */
const CatalogFilterDrawer = ({
  open,
  onClose,
  title,
  closeLabel,
  clearLabel,
  applyLabel,
  onClear,
  onApply,
  children,
}: CatalogFilterDrawerProps) => {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Declared before `useFocusTrap` so the trigger is captured before focus moves into the panel.
  useLayoutEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = overflow
      returnFocusRef.current?.focus()
    }
  }, [open])

  useFocusTrap(panelRef, { active: open, onEscape: onClose })

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-9999">
      <div
        aria-hidden
        className="absolute inset-0 bg-noir-black/70 backdrop-blur-[2px] transition-opacity duration-300 starting:opacity-0"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-xl border border-b-0 border-noir-gold bg-noir-black shadow-[0_-12px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out motion-reduce:transition-none starting:translate-y-full md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:border-y-0 md:border-r-0 md:starting:translate-x-full md:starting:translate-y-0"
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-noir-gold/40 md:hidden" />
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-noir-gold/40 px-5 py-4">
          <h2 id={titleId} className="!text-2xl md:!text-3xl">
            {title}
          </h2>
          <Button
            type="button"
            variant="icon"
            size={null}
            aria-label={closeLabel}
            onClick={onClose}
            className="h-10 w-10 border-transparent text-noir-gold hover:border-noir-gold/50"
          >
            <FiX className="h-6 w-6" aria-hidden />
          </Button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
        <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-noir-gold/40 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="secondary" size="lg" className="w-full md:w-full" onClick={onClear}>
            {clearLabel}
          </Button>
          <Button type="button" variant="primary" size="lg" className="w-full md:w-full" onClick={onApply}>
            {applyLabel}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default CatalogFilterDrawer
