"use client"

import { type ReactNode } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import {
  SidePanelDrawer,
  type SidePanelDrawerChrome,
  type SidePanelDrawerMobileHeight,
} from "@/components/Organisms/SidePanelDrawer"

export type CatalogFilterDrawerMobileHeight = Exclude<
  SidePanelDrawerMobileHeight,
  "full"
>

/** Exchange mockup chrome; Archive/Houses omit this (default). */
export type CatalogFilterDrawerChrome = SidePanelDrawerChrome

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
   * `ornamental` — Exchange: curling corners, ~460px desktop, draft count
   * in the header. Defaults preserve Archive/Houses presentation.
   */
  chrome?: CatalogFilterDrawerChrome
  /** Draft selection label, e.g. "2 selected" (`chrome="ornamental"`). */
  selectionCountLabel?: string
}

/**
 * Bottom sheet below `md`, right-hand panel from `md`. Changes stay in the
 * caller's draft state until Apply. Close / backdrop / Escape cancel without
 * committing. Clear only resets draft (caller).
 *
 * Shell: shared `SidePanelDrawer` (also used by DestashEditorRail).
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
}: CatalogFilterDrawerProps) => (
  <SidePanelDrawer
    open={open}
    onClose={onClose}
    title={title}
    closeLabel={closeLabel}
    mobileHeight={mobileHeight}
    chrome={chrome}
    width={chrome === "ornamental" ? "filterOrnamental" : "filter"}
    selectionCountLabel={selectionCountLabel}
    footer={
      <div className="grid grid-cols-2 gap-3">
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
      </div>
    }
  >
    {children}
  </SidePanelDrawer>
)

export default CatalogFilterDrawer
