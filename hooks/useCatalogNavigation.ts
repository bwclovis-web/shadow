"use client"

import { useRouter } from "next/navigation"
import { useOptimistic, useTransition } from "react"

import { CATALOG_RESULTS_ID } from "@/utils/catalog-params"

/**
 * URL-driven catalog navigation. `state` reflects the requested state immediately and
 * falls back to the server state once the render arrives; `isPending` covers the gap.
 */
export const useCatalogNavigation = <T>(serverState: T) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [state, setOptimisticState] = useOptimistic(serverState)

  const navigate = (
    href: string,
    nextState: T,
    options?: { scrollToResults?: boolean }
  ) => {
    if (options?.scrollToResults) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      document
        .getElementById(CATALOG_RESULTS_ID)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
    }
    startTransition(() => {
      setOptimisticState(nextState)
      router.push(href, { scroll: false })
    })
  }

  return { isPending, state, navigate, prefetch: router.prefetch }
}
