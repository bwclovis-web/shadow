import { useCallback, useEffect, useRef, useState } from "react"

interface UseInViewOptions {
  threshold?: number | number[]
  rootMargin?: string
  root?: Element | null
}

export function useInView<T extends Element = Element>(
  ref: React.RefObject<T>,
  options: UseInViewOptions = {}
): boolean {
  const [isInView, setIsInView] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const { threshold = 0, rootMargin = "0px", root = null } = options

  const callback = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries
    setIsInView(entry.isIntersecting)
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }

    // Create observer if it doesn't exist
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(callback, {
        threshold,
        rootMargin,
        root,
      })
    }

    // Start observing
    observerRef.current.observe(element)

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [
ref, callback, threshold, rootMargin, root
])

  return isInView
}
