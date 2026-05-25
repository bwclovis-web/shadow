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
import {
  type RouteTransitionVariant,
  prepareRouteTransition,
} from "@/utils/route-transitions"

import { buttonVariants } from "./button-variants"
import { Icon, IconName } from "../Icons/Icons"

export interface VooDooLinkProps
  extends Omit<LinkHTMLAttributes<HTMLAnchorElement>, "style">,
    Omit<VariantProps<typeof buttonVariants>, "leftIcon" | "rightIcon"> {
  variant?: "primary" | "secondary" | "danger" | "link" | "icon" | null
  url: string
  ref?: Ref<HTMLAnchorElement>
  background?: "red" | "gold" | null
  children?: ReactNode
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  icon?: IconName
  transitionVariant?: RouteTransitionVariant
}

export const VooDooLink = ({
  className,
  size,
  variant,
  children,
  url,
  background,
  leftIcon,
  rightIcon,
  icon,
  transitionVariant,
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
    prepareRouteTransition(url, transitionVariant)
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
    {leftIcon && <span>{leftIcon}</span>}
    {icon ? <Icon name={icon} /> : null}
    {children}
    {rightIcon && <span>{rightIcon}</span>}
    </Link>
  )
}
