import React, { useMemo } from "react"

import { VirtualScroll } from "~/components/Containers/VirtualScroll"
import type { VirtualScrollProps } from "~/components/Containers/VirtualScroll/types"
import { styleMerge } from "~/utils/styleUtils"

export interface VirtualScrollListProps
  extends Omit<VirtualScrollProps, "children"> {
  renderItem: (item: any, index: number) => React.ReactNode
  itemClassName?: string
  listClassName?: string
  emptyState?: React.ReactNode
  loadingState?: React.ReactNode
  isLoading?: boolean
}

const VirtualScrollList: React.FC<VirtualScrollListProps> = ({
  items,
  itemHeight,
  containerHeight,
  overScan = 5,
  className,
  renderItem,
  itemClassName,
  listClassName,
  emptyState,
  loadingState,
  isLoading = false,
  onScroll,
  scrollToIndex,
  scrollToAlignment,
}) => {
  const hasItems = items.length > 0

  const renderItemWithWrapper = useMemo(
    () => (item: any, index: number) => (
        <div
          key={`${item.id || index}`}
          className={styleMerge("w-full", itemClassName)}
        >
          {renderItem(item, index)}
        </div>
      ),
    [renderItem, itemClassName]
  )

  if (isLoading && loadingState) {
    return (
      <div
        className={styleMerge("flex items-center justify-center h-full", className)}
      >
        {loadingState}
      </div>
    )
  }

  if (!hasItems && emptyState) {
    return (
      <div
        className={styleMerge("flex items-center justify-center h-full", className)}
      >
        {emptyState}
      </div>
    )
  }

  if (!hasItems) {
    return (
      <div
        className={styleMerge(
          "flex items-center justify-center h-full text-gray-500",
          className
        )}
      >
        No items to display
      </div>
    )
  }

  return (
    <div className={styleMerge("w-full", listClassName)}>
      <VirtualScroll
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        overScan={overScan}
        className={className}
        onScroll={onScroll}
        scrollToIndex={scrollToIndex}
        scrollToAlignment={scrollToAlignment}
      >
        {renderItemWithWrapper}
      </VirtualScroll>
    </div>
  )
}

export default VirtualScrollList
