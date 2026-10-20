import { type RefObject, useEffect } from "react"

type MotionConfig = Record<string, string | number>

type UseGsapStaggerOptions = {
  /** CSS selector for child elements to animate, relative to `containerRef`. */
  selector: string
  /** Re-run when these values change (e.g. list length). */
  deps?: unknown[]
  /** Stagger delay between items in seconds. */
  stagger?: number
  enabled?: boolean
  from?: MotionConfig
  to?: MotionConfig
  /**
   * Wait until the container intersects the viewport before animating.
   * Avoids finishing the stagger while the grid is still below the fold.
   */
  whenVisible?: boolean
}

/** Fade/slide-in children with GSAP stagger; no-ops when user prefers reduced motion. */
export const useGsapStagger = (
  containerRef: RefObject<HTMLElement | null>,
  {
    selector,
    deps = [],
    stagger = 0.06,
    enabled = true,
    from,
    to,
    whenVisible = true,
  }: UseGsapStaggerOptions
) => {
  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    const elements = container.querySelectorAll<HTMLElement>(selector)
    if (elements.length === 0) return

    const showWithoutAnimation = (targets: NodeListOf<HTMLElement> | HTMLElement[]) => {
      targets.forEach(el => {
        el.style.opacity = "1"
        el.style.transform = "none"
      })
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      showWithoutAnimation(elements)
      return
    }

    let cancelled = false
    let observer: IntersectionObserver | null = null
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined
    let started = false

    const run = async () => {
      if (cancelled || started) return
      started = true

      try {
        const { gsap } = await import("gsap")
        if (cancelled || !containerRef.current) return

        const targets = containerRef.current.querySelectorAll<HTMLElement>(selector)
        if (targets.length === 0) return

        const fromConfig = from ?? { opacity: 0, y: 14 }
        const toConfig = {
          opacity: 1,
          y: 0,
          duration: 0.42,
          stagger,
          ease: "power2.out",
          clearProps: "transform",
          ...to,
        }

        gsap.fromTo(targets, fromConfig, toConfig)
      } catch {
        if (!cancelled && containerRef.current) {
          showWithoutAnimation(
            containerRef.current.querySelectorAll<HTMLElement>(selector)
          )
        }
      }
    }

    const start = () => {
      observer?.disconnect()
      if (fallbackTimer) clearTimeout(fallbackTimer)
      requestAnimationFrame(() => {
        void run()
      })
    }

    if (!whenVisible || typeof IntersectionObserver === "undefined") {
      start()
    } else {
      observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            start()
          }
        },
        { rootMargin: "40px 0px", threshold: 0.05 }
      )
      observer.observe(container)

      // If already in view, IO may not fire until a layout tick — check once.
      const rect = container.getBoundingClientRect()
      const inView =
        rect.bottom > 0 &&
        rect.top < (window.innerHeight || document.documentElement.clientHeight)
      if (inView) {
        start()
      } else {
        fallbackTimer = setTimeout(start, 2500)
      }
    }

    return () => {
      cancelled = true
      observer?.disconnect()
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps via `deps`
  }, [containerRef, selector, stagger, enabled, whenVisible, ...deps])
}
