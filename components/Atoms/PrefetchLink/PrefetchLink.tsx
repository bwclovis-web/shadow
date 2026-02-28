"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ComponentProps } from "react"

type NextLinkProps = ComponentProps<typeof Link>

const getPrefetchPath = (href: NextLinkProps["href"]): string | null => {
  if (typeof href === "string") return href
  if (typeof href === "object" && href !== null && "pathname" in href) {
    const pathname = (href as { pathname: string }).pathname
    const search = (href as { search?: string }).search ?? ""
    return `${pathname}${search}`
  }
  return null
}

const PrefetchLink = (props: NextLinkProps) => {
  const router = useRouter()
  const path = getPrefetchPath(props.href)
  const { onMouseEnter, ...rest } = props

  return (
    <Link
      {...rest}
      onMouseEnter={(e) => {
        if (path) router.prefetch(path)
        onMouseEnter?.(e)
      }}
    />
  )
}

export { PrefetchLink }
