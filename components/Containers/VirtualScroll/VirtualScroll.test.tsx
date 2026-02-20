import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import VirtualScroll from "./VirtualScroll"

const mockItems = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  value: `Value ${i}`,
}))

const MockItem = ({ item, index }: { item: any; index: number }) => (
  <div data-testid={`item-${index}`}>
    {item.name} - {item.value}
  </div>
)

describe("VirtualScroll", () => {
  it("renders visible items only", () => {
    render(<VirtualScroll
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        overScan={2}
      >
        {(item, index) => <MockItem item={item} index={index} />}
      </VirtualScroll>)

    // Should render only visible items (200px / 50px = 4 items + overScan)
    const visibleItems = screen.queryAllByTestId(/^item-\d+$/)
    expect(visibleItems.length).toBeLessThanOrEqual(8) // 4 visible + 4 overScan
  })

  it("handles scroll events", () => {
    const onScroll = vi.fn()
    const { container } = render(<VirtualScroll
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        onScroll={onScroll}
      >
        {(item, index) => <MockItem item={item} index={index} />}
      </VirtualScroll>)

    const scrollContainer = container.firstChild as HTMLElement
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } })

    expect(onScroll).toHaveBeenCalledWith(100)
  })

  it("scrolls to specific index", async () => {
    const { container } = render(<VirtualScroll
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        scrollToIndex={10}
        scrollToAlignment="start"
      >
        {(item, index) => <MockItem item={item} index={index} />}
      </VirtualScroll>)

    // Wait for the scroll effect to complete and state to update
    await new Promise(resolve => setTimeout(resolve, 100))

    // After scrolling to index 10, items around index 10 should be visible
    // With itemHeight=50 and containerHeight=200, we can see 4 items at once
    // scrollToIndex=10 with 'start' alignment means scrollTop = 10 * 50 = 500
    // Visible range: 500/50 = index 10 to (500+200)/50 = index 13, plus overScan
    const visibleItems = container.querySelectorAll('[data-testid^="item-"]')
    expect(visibleItems.length).toBeGreaterThan(0)

    // Verify that item 10 or nearby items are rendered
    const hasNearbyItems = Array.from(visibleItems).some(ele => {
      const match = ele.getAttribute("data-testid")?.match(/item-(\d+)/)
      if (match) {
        const index = parseInt(match[1], 10)
        return index >= 5 && index <= 20 // Item 10 +/- 10 with overScan
      }
      return false
    })
    expect(hasNearbyItems).toBe(true)
  })

  it("applies custom className", () => {
    const { container } = render(<VirtualScroll
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        className="custom-class"
      >
        {(item, index) => <MockItem item={item} index={index} />}
      </VirtualScroll>)

    expect(container.firstChild).toHaveClass("custom-class")
  })

  it("handles empty items array", () => {
    const { container } = render(<VirtualScroll items={[]} itemHeight={50} containerHeight={200}>
        {(item, index) => <MockItem item={item} index={index} />}
      </VirtualScroll>)

    // Check that no items are rendered
    const items = container.querySelectorAll('[data-testid^="item-"]')
    expect(items).toHaveLength(0)
  })

  it("calculates correct total height", () => {
    const { container } = render(<VirtualScroll items={mockItems} itemHeight={50} containerHeight={200}>
        {(item, index) => <MockItem item={item} index={index} />}
      </VirtualScroll>)

    // The inner div (second div) 
    // should have the total height (100 items * 50px = 5000px)
    const divs = container.querySelectorAll("div")
    // First div is the container (200px), 
    // second div is the inner scrollable area (5000px)
    const innerDiv = divs[1] as HTMLElement
    expect(innerDiv.style.height).toBe("5000px") // 100 items * 50px
  })
})
