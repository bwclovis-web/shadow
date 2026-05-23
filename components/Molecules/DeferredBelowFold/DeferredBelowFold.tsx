"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"

type DeferredBelowFoldProps = {
  children: ReactNode
  /** Reserved height before content mounts (avoids layout shift). */
  minHeight?: string
  className?: string
}

/**
 * Mounts children only when near the viewport to defer client JS and hydration.
 * Used for below-fold homepage sections (activity feed, seasonal trending).
 */
export const DeferredBelowFold = ({
  children,
  minHeight = "12rem",
  className,
}: DeferredBelowFoldProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldMount, setShouldMount] = useState(false)

  useEffect(() => {
    const node = containerRef.current
    if (!node || shouldMount) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldMount(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px 0px", threshold: 0 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [shouldMount])

  return (
    <div ref={containerRef} className={className} style={{ minHeight: shouldMount ? undefined : minHeight }}>
      {shouldMount ? children : null}
    </div>
  )
}
