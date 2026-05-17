import { type RefObject, useEffect } from "react"

type UseGsapStaggerOptions = {
  /** CSS selector for child elements to animate, relative to `containerRef`. */
  selector: string
  /** Re-run when these values change (e.g. list length). */
  deps?: unknown[]
  /** Stagger delay between items in seconds. */
  stagger?: number
  enabled?: boolean
}

/** Fade/slide-in children with GSAP stagger; no-ops when user prefers reduced motion. */
export const useGsapStagger = (
  containerRef: RefObject<HTMLElement | null>,
  { selector, deps = [], stagger = 0.06, enabled = true }: UseGsapStaggerOptions
) => {
  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    const elements = container.querySelectorAll<HTMLElement>(selector)
    if (elements.length === 0) return

    const showWithoutAnimation = () => {
      elements.forEach(el => {
        el.style.opacity = "1"
        el.style.transform = "none"
      })
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      showWithoutAnimation()
      return
    }

    let cancelled = false

    const run = async () => {
      const { gsap } = await import("gsap")
      if (cancelled || !containerRef.current) return

      const targets = containerRef.current.querySelectorAll<HTMLElement>(selector)
      if (targets.length === 0) return

      gsap.fromTo(
        targets,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.42,
          stagger,
          ease: "power2.out",
          clearProps: "transform",
        }
      )
    }

    requestAnimationFrame(() => {
      void run()
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps via `deps`
  }, [containerRef, selector, stagger, enabled, ...deps])
}
