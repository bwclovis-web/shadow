import type { ReactNode } from "react"
import { useId } from "react"

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
  "noir-border p-4 bg-noir-dark/95 text-noir-gold-100 text-sm rounded-sm m-0 w-max max-w-[min(24rem,calc(100vw-1.5rem))]"

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
  const anchorName = `--anchor-${popoverId}`

  return (
    <span className={styleMerge("inline-flex items-center", className)}>
      <style>{`
        [data-anchor="${popoverId}"] { anchor-name: ${anchorName}; }
        #${popoverId} {
          position-anchor: ${anchorName};
          position-area: top;
          position-try-options: flip-block, flip-inline;
        }
      `}</style>
      <Button
        type="button"
        variant="icon"
        size="sm"
        background={background}
        className={styleMerge("max-w-max shrink-0", buttonClassName)}
        aria-label={ariaLabel}
        popoverTarget={popoverId}
        popoverTargetAction="toggle"
        leftIcon={icon}
        data-anchor={popoverId}
      />
      <div
        id={popoverId}
        popover="hint"
        className={styleMerge(defaultPanelClassName, panelClassName)}
      >
        {children}
      </div>
    </span>
  )
}
