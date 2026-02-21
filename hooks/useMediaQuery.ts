import { useEffect, useState } from "react"

/**
 * Custom hook for matching media queries
 *
 * @param query - Media query string (e.g., "(min-width: 768px)")
 * @returns Boolean indicating if the media query matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}

const TABLET = "(min-width: 768px)"
const DESKTOP = "(min-width: 1024px)"

const getPageSize = (isTablet: boolean, isDesktop: boolean): number =>
  isDesktop ? 16 : isTablet ? 8 : 6

/**
 * Hook to get responsive page size based on Tailwind breakpoints
 * - Mobile (< 768px): 6 items
 * - Tablet (768px to < 1024px): 8 items
 * - Desktop (1024px+): 16 items
 *
 * Uses a single effect and state so one re-render when crossing breakpoints.
 * Initial value is 6 for hydration safety until matchMedia runs on the client.
 *
 * @returns Page size based on current screen size
 */
export const useResponsivePageSize = (): number => {
  const [pageSize, setPageSize] = useState(6)

  useEffect(() => {
    const mqTablet = window.matchMedia(TABLET)
    const mqDesktop = window.matchMedia(DESKTOP)

    const update = () =>
      setPageSize(getPageSize(mqTablet.matches, mqDesktop.matches))

    update()
    mqTablet.addEventListener("change", update)
    mqDesktop.addEventListener("change", update)
    return () => {
      mqTablet.removeEventListener("change", update)
      mqDesktop.removeEventListener("change", update)
    }
  }, [])

  return pageSize
}

export default useMediaQuery
