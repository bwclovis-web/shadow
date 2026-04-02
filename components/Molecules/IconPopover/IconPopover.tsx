"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { Button, type ButtonProps } from "@/components/Atoms/Button/Button"
import { styleMerge } from "@/utils/styleUtils"

export type IconPopoverProps = {
  icon: ReactNode
  children: ReactNode
  ariaLabel: string
  className?: string
  panelClassName?: string
  buttonClassName?: string
  background?: ButtonProps["background"]
}

const defaultPanelClassName =
  "noir-border p-4 bg-noir-dark/95 text-noir-gold-100 text-sm max-w-sm rounded-sm"

/**
 * React `useId()` can include `:` (and other characters). Those IDs are invalid or unreliable
 * for `popoverTarget` / `id` matching in some browsers, and declarative invokers can fail silently.
 */
function popoverSafeId(reactId: string) {
  return `icon-popover-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`
}

export default function IconPopover({
  icon,
  children,
  ariaLabel,
  className,
  panelClassName,
  buttonClassName,
  background,
}: IconPopoverProps) {
  const popoverId = popoverSafeId(useId())
  const panelRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const sync = () => {
      try {
        setExpanded(el.matches(":popover-open"))
      } catch {
        setExpanded(false)
      }
    }
    el.addEventListener("toggle", sync)
    sync()
    return () => el.removeEventListener("toggle", sync)
  }, [])

  const handleTriggerClick = useCallback(() => {
    const el = panelRef.current
    if (el && typeof el.togglePopover === "function") {
      el.togglePopover()
    }
  }, [])

  return (
    <span className={styleMerge("inline-flex items-center", className)}>
      <Button
        type="button"
        variant="icon"
        size="sm"
        background={background}
        className={styleMerge("max-w-max shrink-0", buttonClassName)}
        aria-label={ariaLabel}
        aria-expanded={expanded}
        aria-controls={popoverId}
        onClick={handleTriggerClick}
        leftIcon={icon}
      />
      <div
        ref={panelRef}
        id={popoverId}
        popover="auto"
        className={styleMerge(defaultPanelClassName, panelClassName)}
      >
        {children}
      </div>
    </span>
  )
}
