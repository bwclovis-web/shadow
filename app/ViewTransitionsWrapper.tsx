"use client"

import { useEffect, useState } from "react"
import { ViewTransitions } from "next-view-transitions"

export function ViewTransitionsWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updatePreference()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference)
      return () => {
        mediaQuery.removeEventListener("change", updatePreference)
      }
    }

    mediaQuery.addListener(updatePreference)
    return () => {
      mediaQuery.removeListener(updatePreference)
    }
  }, [])

  if (prefersReducedMotion) {
    return <>{children}</>
  }

  return <ViewTransitions>{children}</ViewTransitions>
}
