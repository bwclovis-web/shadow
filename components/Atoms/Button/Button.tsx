import { type VariantProps } from "class-variance-authority"
import { type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react"

import { Icon, type IconName } from "@/components/Atoms/Icons/Icons"
import { styleMerge } from "@/utils/styleUtils"

import { buttonVariants } from "./button-variants"

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style">,
    Omit<VariantProps<typeof buttonVariants>, "leftIcon" | "rightIcon"> {
  variant?: "primary" | "secondary" | "danger" | "icon" | "link" | null
  ref?: RefObject<HTMLButtonElement | null>
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  style?: ButtonHTMLAttributes<HTMLButtonElement>["style"]
  /** Renders a mapped icon (not a DOM `icon` attribute). */
  icon?: IconName
  /** HTML Popover API — not always present on older `@types/react`. */
  popoverTarget?: string
  command?: string
}

export const Button = ({
  className,
  size,
  variant,
  children,
  background,
  leftIcon,
  rightIcon,
  icon,
  type = "button",
  ref,
  style,
  ...props
}: ButtonProps) => (
  <button
    className={
      styleMerge(buttonVariants({ className, size, variant, background,
        leftIcon: leftIcon ? true : false, rightIcon: rightIcon ? true : false }))}
    data-cy="button"
    type={type}
    ref={ref}
    style={style}
    {...props}
  >
    {leftIcon && <span>{leftIcon}</span>}
    {icon ? <Icon name={icon} /> : null}
    {children}
    {rightIcon && <span>{rightIcon}</span>}
  </button>
)
