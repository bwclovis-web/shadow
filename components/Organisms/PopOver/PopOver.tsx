import type { MutableRefObject, ReactNode } from 'react'
import { useCallback, useEffect, useRef } from 'react'

import { usePopoverMenu } from '@/hooks/usePopoverMenu'
import { styleMerge } from '@/utils/styleUtils'
import { Button } from '@/components/Atoms/Button/Button'
import { ButtonVariants } from '../../Atoms/Button/button-variants'
import type { IconName } from '@/components/Atoms/Icons/Icons'
import type { PopOverCloseButtonOptions } from '../../Molecules/PopOverFooter/popOverCloseButton'
import { PopoverFooter } from '../../Molecules/PopOverFooter/PopoverFooter'
import { PopOverHeader } from '../../Molecules/PopOverHeading/PopOverHeader'
import { popOverContentSpacingVariants, popOverHeaderSpacingVariants, PopOverVariants, popOverVariants } from './PopOver-variants'

export type { PopOverCloseButtonOptions } from '../../Molecules/PopOverFooter/popOverCloseButton'

/** Optional ref for opening/closing the popover surface without using the trigger control. */
export type PopOverImperativeHandle = {
  open: () => void
  close: () => void
}

/** Ref object passed to `PopOver` / `ExperimentFinder` to receive `PopOverImperativeHandle`. */
export type PopOverImperativeRef = MutableRefObject<PopOverImperativeHandle | null>

interface PopOverProps {
  children: ReactNode
  menuId: string | number
  size?: PopOverVariants['size']
  placement?: PopOverVariants['placement']

  /**
   * Accessible name for the panel when `header.heading` is empty (sets `aria-label`).
   * When a heading is shown, naming uses `aria-labelledby` instead.
   */
  panelAriaLabel?: string
  header: {
    heading?: string
    closePosition?: 'right' | 'left'
    closeButtonAriaLabel?: string
    headingIcon?: {
      icon: IconName
      position: 'left' | 'right'
    }
  }
  footer?: {
    footerAction?: ReactNode | ((closeMenu: () => void) => ReactNode)
    closeButton?: PopOverCloseButtonOptions | false
    closeButtonLabel?: string
  }
  trigger?: {
    triggerVariant?: ButtonVariants['variant']
    triggerSize?: ButtonVariants['size']
    triggerText?: string
    triggerIcon?: IconName
    triggerAriaLabel?: string
  }
  imperativeRef?: PopOverImperativeRef
}

export const PopOver = ({
  children,
  menuId,
  panelAriaLabel,
  size = 'sm',
  trigger = {
    triggerVariant: 'secondary',
    triggerSize: 'md',
    triggerText: '',
    triggerIcon: undefined
  },
  placement = 'above',
  header = {
    heading: '',
    closePosition: 'right',
    headingIcon: {
      icon: 'x',
      position: 'right'
    }
  },
  footer: footerProp,
  imperativeRef
  }: PopOverProps) => {
  const footer = footerProp ?? {}
  const popoverId = `--menu-${menuId}`
  const anchorName = `--popover-anchor-${menuId}`
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeMenu = useCallback(() => {
    const popover = popoverRef.current
    if (
      popover &&
      'hidePopover' in popover &&
      typeof (popover as HTMLDivElement & { hidePopover: () => void }).hidePopover === 'function'
    ) {
      ;(popover as HTMLDivElement & { hidePopover: () => void }).hidePopover()
    }
  }, [])

  const openMenu = useCallback(() => {
    const popover = popoverRef.current
    if (
      popover &&
      'showPopover' in popover &&
      typeof (popover as HTMLDivElement & { showPopover: () => void }).showPopover === 'function'
    ) {
      ;(popover as HTMLDivElement & { showPopover: () => void }).showPopover()
    }
  }, [])

  useEffect(() => {
    if (!imperativeRef) {
      return
    }
    imperativeRef.current = {
      open: openMenu,
      close: closeMenu
    }
    return () => {
      imperativeRef.current = null
    }
  }, [closeMenu, imperativeRef, openMenu])

  const { menuProps } = usePopoverMenu({
    behavior: 'panel',
    menuRef: popoverRef,
    onClose: closeMenu,
    triggerRef
  })


  const panelHeadingId = `popover-panel-title-${String(menuId)}`

  return (
    <>
      <Button
        ref={triggerRef}
        size={trigger.triggerSize}
        popoverTarget={popoverId}
        command="toggle-popover"
        style={{ anchorName: anchorName }}
        icon={trigger.triggerIcon}
      >
        {trigger.triggerText}
      </Button>
      <div
        ref={popoverRef}
        id={popoverId}
        popover="auto"
        role="dialog"
        aria-modal={false}
        className={styleMerge(popOverVariants({ placement, size }))}
        style={{ positionAnchor: anchorName }}
        {...menuProps}
      >
        <div className={styleMerge(popOverHeaderSpacingVariants({ size }))}>
          <PopOverHeader
            closeButtonAriaLabel={header.closeButtonAriaLabel}
            closePosition={header.closePosition}
            closeMenu={closeMenu}
            heading={header.heading}
            headingIcon={header.headingIcon}
            headingId={panelHeadingId}
            size={size}
          />
        </div>
        <div className={styleMerge(popOverContentSpacingVariants({ size }))}>
          {children}
        </div>
        <PopoverFooter
          closeButtonLabel={footer.closeButtonLabel}
          closeButton={footer.closeButton}
          closeMenu={closeMenu}
          footerAction={footer.footerAction}
          size={size}
        />
      </div>
    </>
  )
}

export default PopOver
