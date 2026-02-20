import { useEffect, useState } from "react"

/**
 * Custom hook for matching media queries
 * 
 * @param query - Media query string (e.g., "(min-width: 768px)")
 * @returns Boolean indicating if the media query matches
 */
// Use a constant initial value so server and first client render match (avoids hydration mismatch).
const getInitialMatches = () => false

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(getInitialMatches)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia(query)
    // Set actual value after mount so hydration matches (initial is always false).
    setMatches(mediaQuery.matches)

    // Create event listener
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern browsers support addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler)
      return () => mediaQuery.removeEventListener("change", handler)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler)
      return () => mediaQuery.removeListener(handler)
    }
  }, [query])

  return matches
}

/**
 * Hook to get responsive page size based on Tailwind breakpoints
 * - Mobile (< 768px): 6 items
 * - Tablet (768px to < 1024px): 8 items
 * - Desktop (1024px+): 16 items
 *
 * Note: On first render (and during SSR) both media queries are false for
 * hydration safety, so the initial value is 6 until the client runs and
 * matchMedia is evaluated.
 *
 * @returns Page size based on current screen size
 */
export const useResponsivePageSize = (): number => {
  const isTablet = useMediaQuery("(min-width: 768px)")
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  if (isDesktop) {
    return 16
  }
  if (isTablet) {
    return 8
  }
  return 6
}

export default useMediaQuery
