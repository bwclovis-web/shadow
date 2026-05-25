"use client"

import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types"
import { Link } from "next-view-transitions"
import { useTransitionRouter } from "next-view-transitions"
import type { ComponentProps } from "react"

import {
  type RouteTransitionVariant,
  prepareRouteTransition,
} from "@/utils/route-transitions"

type NextLinkProps = ComponentProps<typeof Link>

type PrefetchLinkProps = NextLinkProps & {
  transitionVariant?: RouteTransitionVariant
}

const getPrefetchPath = (href: NextLinkProps["href"]): string | null => {
  if (typeof href === "string") return href
  if (typeof href === "object" && href !== null && "pathname" in href) {
    const pathname = (href as { pathname: string }).pathname
    const search = (href as { search?: string }).search ?? ""
    return `${pathname}${search}`
  }
  return null
}

const PrefetchLink = (props: PrefetchLinkProps) => {
  const router = useTransitionRouter()
  const path = getPrefetchPath(props.href)
  const { onClick, onMouseEnter, onTouchStart, transitionVariant, ...rest } = props

  const prefetchFullRoute = () => {
    if (!path) return
    router.prefetch(path, { kind: PrefetchKind.FULL })
  }

  return (
    <Link
      {...rest}
      onClick={(e) => {
        if (path) {
          prepareRouteTransition(path, transitionVariant)
        }
        onClick?.(e)
      }}
      onMouseEnter={(e) => {
        prefetchFullRoute()
        onMouseEnter?.(e)
      }}
      onTouchStart={(e) => {
        prefetchFullRoute()
        onTouchStart?.(e)
      }}
    />
  )
}

export { PrefetchLink }
