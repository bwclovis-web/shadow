import type { KeyboardEvent, RefObject } from "react"
import { useCallback } from "react"

type UsePopoverMenuArgs = {
  behavior: "panel"
  menuRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

export const usePopoverMenu = ({ menuRef: _menuRef, onClose }: UsePopoverMenuArgs) => {
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    },
    [onClose],
  )

  return {
    menuProps: {
      onKeyDown,
    },
  }
}
