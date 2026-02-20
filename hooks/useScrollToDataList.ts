import { useEffect, useRef } from "react"

type ScrollOffset = number | (() => number)
type StickyHeaderResolver = () => HTMLElement | null

interface UseScrollToDataListOptions {
  trigger: string | number | null
  enabled?: boolean
  isLoading?: boolean
  hasData?: boolean
  delay?: number
  offset?: ScrollOffset
  additionalOffset?: number
  skipInitialScroll?: boolean
  resolveStickyHeader?: StickyHeaderResolver
}

export function useScrollToDataList({
  trigger,
  enabled = true,
  isLoading = false,
  hasData = false,
  delay = 200,
  offset,
  additionalOffset = 12,
  skipInitialScroll = false,
  resolveStickyHeader,
}: UseScrollToDataListOptions) {
  const previousTriggerRef = useRef<string | number | null>(null)
  const scrollAttemptedRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSkippedInitialRef = useRef(false)

  // Track when trigger changes to reset scroll flag
  useEffect(() => {
    if (!enabled || !trigger) {
      scrollAttemptedRef.current = false
      previousTriggerRef.current = trigger
      return
    }

    const triggerChanged = previousTriggerRef.current !== trigger
    if (triggerChanged) {
      scrollAttemptedRef.current = false
      previousTriggerRef.current = trigger
    }
  }, [trigger, enabled])

  // Scroll when data is ready (after loading completes)
  useEffect(() => {
    if (!enabled || !trigger || isLoading || !hasData || scrollAttemptedRef.current) {
      return
    }

    if (skipInitialScroll && !hasSkippedInitialRef.current) {
      hasSkippedInitialRef.current = true
      scrollAttemptedRef.current = true
      return
    }

    const measureElementHeight = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      const height = rect.height || element.offsetHeight || element.scrollHeight
      return height || 0
    }

    const resolveStickyHeaderOffset = () => {
      if (resolveStickyHeader) {
        const customHeader = resolveStickyHeader()
        return customHeader ? measureElementHeight(customHeader) : 0
      }

      const headerElements =
        document.querySelectorAll<HTMLElement>("[data-sticky-header]")
      if (!headerElements.length) {
        return 0
      }

      return Array.from(headerElements).reduce(
        (total, element) => total + measureElementHeight(element),
        0
      )
    }

    const resolveOffset = () => {
      if (typeof offset === "number") {
        return offset
      }

      if (typeof offset === "function") {
        try {
          return offset()
        } catch {
          return resolveStickyHeaderOffset()
        }
      }

      return resolveStickyHeaderOffset()
    }

    const scrollToElement = () => {
      if (typeof window === "undefined" || typeof document === "undefined") {
        return false
      }

      const dataListElement = document.getElementById("data-list")
      if (dataListElement) {
        // Check if element has content (children)
        const ulElement = dataListElement.querySelector("ul")
        const hasContent = (ulElement?.children.length ?? 0) > 0
        
        if (hasContent) {
          const elementTop =
            window.scrollY + dataListElement.getBoundingClientRect().top
          const totalOffset = Math.max(resolveOffset() + additionalOffset, 0)
          const targetPosition = Math.max(elementTop - totalOffset, 0)

          window.scrollTo({
            top: targetPosition,
            behavior: "smooth",
          })

          scrollAttemptedRef.current = true
          return true
        }
      }
      return false
    }

    // Use requestAnimationFrame to ensure DOM is painted, then scroll
    const rafId = requestAnimationFrame(() => {
      timeoutRef.current = setTimeout(() => {
        // Double-check conditions before scrolling
        if (!isLoading && hasData && !scrollAttemptedRef.current) {
          scrollToElement()
        }
      }, delay)
    })

    return () => {
      cancelAnimationFrame(rafId)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [
    trigger,
    enabled,
    isLoading,
    hasData,
    delay,
    offset,
    additionalOffset,
    skipInitialScroll,
    resolveStickyHeader,
  ])
}

