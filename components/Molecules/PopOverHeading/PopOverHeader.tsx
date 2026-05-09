import { styleMerge } from '@/utils/styleUtils'
import { Button } from '../../Atoms/Button/Button'
import { hasMeaningfulButtonChildren } from '../../Atoms/Button/buttonHelpers'
import { Icon, type IconName } from '../../Atoms/Icons/Icons'
import { PopOverVariants } from '../../Organisms/PopOver/PopOver-variants'

export interface PopOverHeaderProps {

  /** When set with a non-empty `heading`, applied to the `<h2>` for `aria-labelledby` on the panel. */
  headingId?: string
  closePosition?: 'right' | 'left'
  closeButtonAriaLabel?: string
  headingIcon?: {
    icon: IconName
    position: 'left' | 'right'
  }
  heading?: string
  closeMenu: () => void
  size?: PopOverVariants['size']
}

const CloseButton = ({ ariaLabel, closeMenu }: { ariaLabel: string; closeMenu: () => void }) => (
  <Button aria-label={ariaLabel} icon="x" onClick={closeMenu} size="sm" variant="icon" />
)

export const PopOverHeader = ({
  closePosition = 'right',
  closeButtonAriaLabel = 'Close',
  closeMenu,
  headingIcon,
  headingId,
  size,
  heading
}: PopOverHeaderProps) => (
  <header className="flex justify-between items-center">
    {closePosition === 'left' && <CloseButton ariaLabel={closeButtonAriaLabel} closeMenu={closeMenu} />}
    {headingIcon && headingIcon.position === 'left' && <Icon name={headingIcon.icon} />}
    {hasMeaningfulButtonChildren(heading) && (
      <h2
        className={styleMerge('text-lg mb-0 inline-block text-pretty', size === 'sm' ? 'text-type-s' : 'text-type-l')}
        id={headingId}
      >
        {heading}
      </h2>
    )}
    {closePosition === 'right' && <CloseButton ariaLabel={closeButtonAriaLabel} closeMenu={closeMenu} />}
    {headingIcon && headingIcon.position === 'right' && <Icon name={headingIcon.icon} />}
  </header>
)
