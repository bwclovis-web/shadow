import { type VariantProps } from "class-variance-authority"
import { type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react"

import { styleMerge } from "@/utils/styleUtils"

import { buttonVariants } from "./button-variants"

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style">,
    Omit<VariantProps<typeof buttonVariants>, "leftIcon" | "rightIcon"> {
  variant?: "primary" | "secondary" | "danger" | "icon" | null
  ref?: RefObject<HTMLButtonElement | null>
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = ({
  className,
  size,
  variant,
  children,
  background,
  leftIcon,
  rightIcon,
  type = "button",
  ref,
  ...props
}: ButtonProps) => (
  <button
    className={
      styleMerge(buttonVariants({ className, size, variant, background,
        leftIcon: leftIcon ? true : false, rightIcon: rightIcon ? true : false }))}
    data-cy="button"
    type={type}
    ref={ref}
    {...props}
  >
    {leftIcon && <span>{leftIcon}</span>}
    {children}
    {rightIcon && <span>{rightIcon}</span>}
  </button>
)
