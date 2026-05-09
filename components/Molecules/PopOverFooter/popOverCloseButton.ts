import type { ButtonVariants } from '../../Atoms/Button/button-variants'
import type { IconName } from '../../Atoms/Icons/Icons'

export interface PopOverCloseButtonOptions {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']

  /** If omitted, the dismiss control is text-only (uses `closeButtonLabel` / default `Cancel`). */
  icon?: IconName

  /**
   * Optional accessible name override. Only non-empty values are forwarded; otherwise
   * {@link PopoverFooter} derives the name from visible label text, or uses a default for icon-only.
   */
  ariaLabel?: string
}

export const popOverCloseButtonProps = (options: PopOverCloseButtonOptions | undefined) => {
  const icon = options?.icon
  const trimmedAria = options?.ariaLabel?.trim()

  return {
    variant: options?.variant ?? 'secondary',
    size: options?.size ?? 'sm',
    ...(icon ? { icon } : {}),
    ...(trimmedAria ? { "aria-label": trimmedAria } : {})
  } as const
}
