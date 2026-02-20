import type { ReactNode } from "react"

export interface VirtualScrollProps {
  items: any[]
  itemHeight: number
  containerHeight: number
  overScan?: number
  className?: string
  children: (item: any, index: number) => ReactNode
  onScroll?: (scrollTop: number) => void
  scrollToIndex?: number
  scrollToAlignment?: "start" | "center" | "end"
}
