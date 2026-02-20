import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { styleMerge } from "~/utils/styleUtils"

import type { VirtualScrollProps } from "./types"

const VirtualScroll: React.FC<VirtualScrollProps> = ({
  items,
  itemHeight,
  containerHeight,
  overScan = 5,
  className,
  children,
  onScroll,
  scrollToIndex,
  scrollToAlignment = "start",
}) => {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overScan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overScan
    )
    return { startIndex, endIndex }
  }, [
scrollTop, itemHeight, containerHeight, items.length, overScan
])

  // Get visible items
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index,
      top: (startIndex + index) * itemHeight,
    }))
  }, [items, visibleRange, itemHeight])

  // Handle scroll events
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop
      setScrollTop(newScrollTop)
      onScroll?.(newScrollTop)
    },
    [onScroll]
  )

  // Scroll to specific index
  useEffect(() => {
    if (scrollToIndex !== undefined && scrollElementRef.current) {
      const element = scrollElementRef.current
      let scrollTop: number

      switch (scrollToAlignment) {
        case "start":
          scrollTop = scrollToIndex * itemHeight
          break
        case "center":
          scrollTop =
            scrollToIndex * itemHeight - containerHeight / 2 + itemHeight / 2
          break
        case "end":
          scrollTop = scrollToIndex * itemHeight - containerHeight + itemHeight
          break
        default:
          scrollTop = scrollToIndex * itemHeight
      }

      element.scrollTop = Math.max(0, scrollTop)
    }
  }, [
scrollToIndex, scrollToAlignment, itemHeight, containerHeight
])

  const totalHeight = items.length * itemHeight

  return (
    <div
      ref={scrollElementRef}
      className={styleMerge("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map(({ item, index, top }) => (
          <div
            key={index}
            style={{
              position: "absolute",
              top,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {children(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
}

export { VirtualScroll }
export default VirtualScroll
