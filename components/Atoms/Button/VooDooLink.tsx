"use client"

import { type VariantProps } from "class-variance-authority"
import { Link } from "next-view-transitions"
import { useTransitionRouter } from "next-view-transitions"
import {
  type LinkHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react"

import { styleMerge } from "@/utils/styleUtils"

import { buttonVariants } from "./button-variants"

export interface VooDooLinkProps
  extends Omit<LinkHTMLAttributes<HTMLAnchorElement>, "style">,
    VariantProps<typeof buttonVariants> {
  variant?: "primary" | "secondary" | "danger" | "link" | "icon" | null
  url: string
  ref?: Ref<HTMLAnchorElement>
  background?: "red" | "gold" | null
  children?: ReactNode
}

export const VooDooLink = ({
  className,
  size,
  variant,
  children,
  url,
  background,
  onClick,
  ...props
}: VooDooLinkProps) => {
  const router = useTransitionRouter()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (props["aria-disabled"]) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onClick?.(event)
  }

  return (
    <Link
      href={url}
      prefetch={true}
      className={styleMerge(buttonVariants({ className, size, variant, background }))}
      onMouseEnter={() => router.prefetch(url)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  )
}
