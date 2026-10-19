"use client"

import { type ReactNode, useId, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { FiX } from "react-icons/fi"

import { Button } from "@/components/Atoms/Button/Button"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { useFocusTrap } from "@/hooks/useFocusTrap"
import { styleMerge } from "@/utils/styleUtils"

export type CatalogFilterDrawerMobileHeight = "compact" | "nearlyFull"

export type CatalogFilterDrawerChrome = "default" | "ornamental"

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
  /**
   * Mobile bottom-sheet height. Archive/Houses keep `compact` (85dvh).
   * Exchange uses `nearlyFull` (~96dvh) to match collectors sheet.
   */
  mobileHeight?: CatalogFilterDrawerMobileHeight
  /**
   * `ornamental` — Exchange mockup: SVG corners, ~460px desktop, selection
   * count beside the title. Archive/Houses keep `default`.
   */
  chrome?: CatalogFilterDrawerChrome
  /** e.g. "2 selected" — shown in the header when `chrome="ornamental"`. */
  selectionCountLabel?: string
}

/**
 * Bottom sheet below `md`, right-hand panel from `md`. Changes stay in the
 * caller's draft state until Apply. Close / backdrop / Escape cancel without
 * committing. Clear only resets draft (caller).
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
  mobileHeight = "compact",
  chrome = "default",
  selectionCountLabel,
}: CatalogFilterDrawerProps) => {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const ornamental = chrome === "ornamental"

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

  const header = (
    <header className="flex shrink-0 items-center gap-3 border-b border-noir-gold/40 px-5 py-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h2 id={titleId} className="!mb-0 !pb-0 !text-2xl capitalize md:!text-3xl">
          {title}
        </h2>
        {ornamental && selectionCountLabel ? (
          <p className="truncate text-sm text-noir-gold-100">{selectionCountLabel}</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="icon"
        size={null}
        aria-label={closeLabel}
        onClick={onClose}
        className="h-10 w-10 shrink-0 border-transparent text-noir-gold hover:border-noir-gold/50"
      >
        <FiX className="h-6 w-6" aria-hidden />
      </Button>
    </header>
  )

  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:px-6">
      {children}
    </div>
  )

  const footer = (
    <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-noir-gold/40 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full md:w-full"
        onClick={onClear}
      >
        {clearLabel}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full md:w-full"
        onClick={onApply}
      >
        {applyLabel}
      </Button>
    </footer>
  )

  return createPortal(
    <div className="fixed inset-0 z-9999">
      <div
        aria-hidden
        className="absolute inset-0 bg-noir-black/70 backdrop-blur-[2px] transition-opacity duration-300 starting:opacity-0"
        onClick={onClose}
      />
      {ornamental ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={styleMerge(
            "absolute inset-x-0 bottom-0 top-[4dvh] max-h-[96dvh] transition-transform duration-300 ease-out motion-reduce:transition-none starting:translate-y-full",
            "md:inset-y-3 md:left-auto md:right-3 md:max-h-none md:w-[28.75rem] md:starting:translate-x-full md:starting:translate-y-0"
          )}
        >
          <OrnamentalFrame
            size="standard"
            className="flex h-full min-h-0 flex-col bg-noir-black shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
          >
            <div className="flex h-full min-h-0 flex-col">
              <div
                aria-hidden
                className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-noir-gold/40 md:hidden"
              />
              {header}
              {body}
              {footer}
            </div>
          </OrnamentalFrame>
        </div>
      ) : (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={styleMerge(
            "absolute inset-x-0 bottom-0 flex flex-col border border-b-0 border-noir-gold bg-noir-black shadow-[0_-12px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out motion-reduce:transition-none starting:translate-y-full",
            "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:border-y-0 md:border-r-0 md:starting:translate-x-full md:starting:translate-y-0",
            mobileHeight === "nearlyFull"
              ? "top-[4dvh] max-h-[96dvh] rounded-t-xl"
              : "max-h-[85dvh] rounded-t-xl"
          )}
        >
          <div
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-noir-gold/40 md:hidden"
          />
          {header}
          {body}
          {footer}
        </div>
      )}
    </div>,
    document.body
  )
}

export default CatalogFilterDrawer
