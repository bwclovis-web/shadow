import type { ReactNode } from 'react'

import { styleMerge } from '../../../utils'
import { Button } from '../../Atoms/Button/Button'
import {
  popOverFooterSpacingVariants,
  PopOverVariants
} from '../../Organisms/PopOver/PopOver-variants'
import { type PopOverCloseButtonOptions, popOverCloseButtonProps } from './popOverCloseButton'

export interface PopoverFooterProps {
  footerAction?: ReactNode | ((closeMenu: () => void) => ReactNode)
  closeMenu: () => void
  closeButton?: PopOverCloseButtonOptions | false
  size?: PopOverVariants['size']

  /** Visible label for the dismiss control; defaults to `'Cancel'`. */
  closeButtonLabel?: string
}

export const PopoverFooter = ({
  footerAction,
  closeMenu,
  closeButton,
  size,
  closeButtonLabel
}: PopoverFooterProps) => {
  const footerSlot =
    typeof footerAction === 'function' ? footerAction(closeMenu) : footerAction

  const dismiss = (() => {
    if (closeButton === false) {
      return null
    }
    const closeProps = popOverCloseButtonProps(closeButton === undefined ? undefined : closeButton)
    const buttonSize = size === 'lg' ? 'md' : closeProps.size
    const hasCloseIcon = 'icon' in closeProps && Boolean(closeProps.icon)
    const rawDismissLabel = closeButtonLabel ?? 'Cancel'
    const dismissButtonLabel =
      !hasCloseIcon &&
      typeof rawDismissLabel === 'string' &&
      rawDismissLabel.trim() === ''
        ? 'Cancel'
        : rawDismissLabel

    const visibleName =
      typeof dismissButtonLabel === 'string' ? dismissButtonLabel.trim() : ''
    const explicitDismissAria =
      closeButton !== false &&
      closeButton !== undefined &&
      typeof closeButton.ariaLabel === 'string' &&
      closeButton.ariaLabel.trim() !== ''
        ? closeButton.ariaLabel.trim()
        : undefined
    const dismissAriaLabel =
      explicitDismissAria ?? (hasCloseIcon && !visibleName ? 'Close' : undefined)

    return (
      <Button {...closeProps} ariaLabel={dismissAriaLabel} onClick={closeMenu} size={buttonSize}>
        {dismissButtonLabel}
      </Button>
    )
  })()

  if (!dismiss && (footerSlot === undefined || footerSlot === null || footerSlot === false)) {
    return null
  }

  return (
    <footer
      className={styleMerge(
        popOverFooterSpacingVariants({ size }),
        'flex justify-between items-center gap-2'
      )}
    >
      {dismiss}
      {footerSlot}
    </footer>
  )
}
