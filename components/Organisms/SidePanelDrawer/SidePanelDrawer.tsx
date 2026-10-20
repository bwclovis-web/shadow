"use client"

import { type ReactNode, useId, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { FiX } from "react-icons/fi"

import { Button } from "@/components/Atoms/Button/Button"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { useFocusTrap } from "@/hooks/useFocusTrap"
import { styleMerge } from "@/utils/styleUtils"

export type SidePanelDrawerMobileHeight = "compact" | "nearlyFull" | "full"

export type SidePanelDrawerChrome = "default" | "ornamental"

export type SidePanelDrawerWidth = "filter" | "filterOrnamental" | "editor"

export type SidePanelDrawerProps = {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: ReactNode
  /** Fixed footer (e.g. Clear/Apply or Cancel/Save). Omit for body-only. */
  footer?: ReactNode
  /** Optional content between title and close (e.g. Open full page). */
  headerAside?: ReactNode
  mobileHeight?: SidePanelDrawerMobileHeight
  chrome?: SidePanelDrawerChrome
  width?: SidePanelDrawerWidth
  /** Ornamental filter chrome: e.g. "2 selected". */
  selectionCountLabel?: string
}

const WIDTH_CLASS: Record<SidePanelDrawerWidth, string> = {
  filter: "md:w-[26rem]",
  filterOrnamental: "md:w-[28.75rem]",
  /** 480px tablet / 520px desktop (≥1200px). */
  editor: "md:w-[480px] min-[1200px]:w-[520px]",
}

/**
 * Accessible right-rail / mobile sheet shell (scrim, scroll lock, focus trap).
 * Used by CatalogFilterDrawer and DestashEditorRail.
 */
export const SidePanelDrawer = ({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  headerAside,
  mobileHeight = "compact",
  chrome = "default",
  width = "filter",
  selectionCountLabel,
}: SidePanelDrawerProps) => {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const scrollYRef = useRef(0)
  const ornamental = chrome === "ornamental"
  const widthClass = WIDTH_CLASS[width]

  useLayoutEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement as HTMLElement | null
    scrollYRef.current = window.scrollY
    const { overflow, position, top, width: bodyWidth } = document.body.style
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollYRef.current}px`
    document.body.style.width = "100%"
    return () => {
      document.body.style.overflow = overflow
      document.body.style.position = position
      document.body.style.top = top
      document.body.style.width = bodyWidth
      window.scrollTo(0, scrollYRef.current)
      returnFocusRef.current?.focus()
    }
  }, [open])

  useFocusTrap(panelRef, { active: open, onEscape: onClose })

  if (!open || typeof document === "undefined") return null

  const dragHandle =
    mobileHeight === "full" ? null : (
      <div
        aria-hidden
        className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-noir-gold/40 md:hidden"
      />
    )

  const header = (
    <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-noir-gold/40 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:pt-4">
      <h2
        id={titleId}
        className="!mb-0 !shrink-0 !pb-0 !text-2xl !leading-none capitalize md:!text-3xl"
      >
        {title}
      </h2>
      {headerAside ? (
        <div className="min-w-0 flex-1">{headerAside}</div>
      ) : ornamental && selectionCountLabel ? (
        <p className="min-w-0 flex-1 truncate text-right text-sm !leading-none text-noir-gold-100">
          {selectionCountLabel}
        </p>
      ) : (
        <div className="min-w-0 flex-1" aria-hidden />
      )}
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
    <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:px-6">
      {children}
    </div>
  )

  const footerBlock = footer ? (
    <footer className="relative z-10 shrink-0 border-t border-noir-gold/40 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom),env(keyboard-inset-height,0px))] md:px-6">
      {footer}
    </footer>
  ) : null

  const mobilePositionClass =
    mobileHeight === "full"
      ? "inset-0 max-h-none rounded-none"
      : mobileHeight === "nearlyFull"
        ? "inset-x-0 bottom-0 top-[4dvh] max-h-[96dvh] rounded-t-xl"
        : "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl"

  const panelShellClass = styleMerge(
    "absolute flex flex-col border border-noir-gold bg-noir-black shadow-[0_-12px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out motion-reduce:transition-none starting:translate-y-full",
    mobilePositionClass,
    "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:rounded-none md:border-y-0 md:border-r-0 md:starting:translate-x-full md:starting:translate-y-0",
    widthClass
  )

  const dialogInner = (
    <>
      {dragHandle}
      {header}
      {body}
      {footerBlock}
    </>
  )

  return createPortal(
    <div className="fixed inset-0 z-9999">
      <div
        aria-hidden
        className="absolute inset-0 bg-noir-black/70 backdrop-blur-[2px] transition-opacity duration-300 starting:opacity-0"
        onClick={onClose}
      />
      {ornamental ? (
        <OrnamentalFrame
          size="standard"
          clipContent={false}
          className={styleMerge(
            "absolute inset-x-0 bottom-0 top-[4dvh] flex max-h-[96dvh] flex-col bg-noir-black shadow-[0_-12px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out motion-reduce:transition-none starting:translate-y-full",
            "md:inset-y-3 md:left-auto md:right-3 md:top-3 md:bottom-3 md:max-h-none md:starting:translate-x-full md:starting:translate-y-0",
            widthClass
          )}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex min-h-0 flex-1 flex-col"
          >
            {dialogInner}
          </div>
        </OrnamentalFrame>
      ) : (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={panelShellClass}
        >
          {dialogInner}
        </div>
      )}
    </div>,
    document.body
  )
}

export default SidePanelDrawer
