"use client"

import { useId, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { FiX } from "react-icons/fi"

import { Button } from "@/components/Atoms/Button/Button"
import { ExchangeCollectorsOffers } from "@/components/Molecules/ExchangeCollectorsOffers/ExchangeCollectorsOffers"
import type { ExchangeOffersStatus } from "@/hooks/useExchangeOffers"
import { useFocusTrap } from "@/hooks/useFocusTrap"
import { useSessionStore } from "@/hooks/sessionStore"
import type { ExchangeOfferDto } from "@/types/exchange-discovery"
import { styleMerge } from "@/utils/styleUtils"

export type ExchangeCollectorsPanelProps = {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  perfumeName: string
  perfumeImage?: string | null
  offers: ExchangeOfferDto[]
  status: ExchangeOffersStatus
  errorMessage: string | null
  hasMore: boolean
  loadingMore: boolean
  viewerId?: string | null
  signInHref: string
  removedOfferIds?: Set<string>
  contactBusyOfferId?: string | null
  onContact: (offer: ExchangeOfferDto) => void
  onRetry: () => void
  onLoadMore: () => void
  /** `sheet` = nearly full-screen (mobile); `panel` = wide right side. */
  variant: "sheet" | "panel"
}

/**
 * Grid View collectors host. Pauses its focus trap while the session Modal
 * (photo lightbox / trade composer) is open so overlays are not nested.
 */
export const ExchangeCollectorsPanel = ({
  open,
  onClose,
  title,
  closeLabel,
  perfumeName,
  perfumeImage,
  offers,
  status,
  errorMessage,
  hasMore,
  loadingMore,
  viewerId,
  signInHref,
  removedOfferIds,
  contactBusyOfferId,
  onContact,
  onRetry,
  onLoadMore,
  variant,
}: ExchangeCollectorsPanelProps) => {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const sessionModalOpen = useSessionStore(s => s.modalOpen)

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

  useFocusTrap(panelRef, {
    active: open && !sessionModalOpen,
    onEscape: onClose,
  })

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-9999">
      <div
        aria-hidden
        className="absolute inset-0 bg-noir-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styleMerge(
          "absolute flex flex-col border border-noir-gold bg-noir-black shadow-[0_-12px_40px_rgba(0,0,0,0.6)]",
          variant === "sheet"
            ? "inset-x-2 bottom-0 top-[4dvh] max-h-[96dvh] rounded-t-xl border-b-0"
            : "inset-y-0 right-0 w-[min(36rem,92vw)] border-y-0 border-r-0"
        )}
      >
        {variant === "sheet" ? (
          <div
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-noir-gold/40"
          />
        ) : null}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-noir-gold/40 px-5 py-4">
          <h2 id={titleId} className="!text-xl md:!text-2xl">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ExchangeCollectorsOffers
            perfumeName={perfumeName}
            perfumeImage={perfumeImage}
            offers={offers}
            status={status}
            errorMessage={errorMessage}
            hasMore={hasMore}
            loadingMore={loadingMore}
            viewerId={viewerId}
            signInHref={signInHref}
            removedOfferIds={removedOfferIds}
            contactBusyOfferId={contactBusyOfferId}
            onContact={onContact}
            onRetry={onRetry}
            onLoadMore={onLoadMore}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
