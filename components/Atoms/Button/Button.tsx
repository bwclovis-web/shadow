"use client"

import { type VariantProps } from "class-variance-authority"
import { type ButtonHTMLAttributes, type LinkHTMLAttributes, type ReactNode, type Ref, type RefObject } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { styleMerge } from "@/utils/styleUtils"

import { buttonVariants } from "./button-variants"

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style">,
    Omit<VariantProps<typeof buttonVariants>, "leftIcon" | "rightIcon"> {
  variant?: "primary" | "secondary" | "danger" | "icon" | null
  ref?: RefObject<HTMLButtonElement | null>
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

interface LinkProps
  extends Omit<LinkHTMLAttributes<HTMLAnchorElement>, "style">,
    VariantProps<typeof buttonVariants> {
  variant?: "primary" | "secondary" | "danger" | "link" | "icon" | null
  url: string
  ref?: Ref<HTMLAnchorElement>
  background?: "red" | "gold" | null
}

const Button = ({
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

const VooDooLink = ({
  className,
  size,
  variant,
  children,
  url,
  background,
  ...props
}: LinkProps) => {
  const router = useRouter()

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if(props["aria-disabled"]){
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }

  return (
    <Link
      href={url}
      prefetch={true}
      className={styleMerge(buttonVariants({ className, size, variant, background }))}
      onMouseEnter={() => router.prefetch(url)}
      {...props}
    >
      {children}
    </Link>
  )
}
export { Button, VooDooLink }
