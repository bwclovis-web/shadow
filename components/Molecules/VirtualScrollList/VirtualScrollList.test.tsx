import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import VirtualScrollList from "./VirtualScrollList"

const mockItems = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  value: `Value ${i}`,
}))

const MockItem = ({ item, index }: { item: any; index: number }) => (
  <div data-testid={`item-${index}`}>
    {item.name} - {item.value}
  </div>
)

describe("VirtualScrollList", () => {
  it("renders items with virtual scrolling", () => {
    render(<VirtualScrollList
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        renderItem={(item, index) => <MockItem item={item} index={index} />}
      />)

    const visibleItems = screen.getAllByTestId(/^item-\d+$/)
    expect(visibleItems.length).toBeGreaterThan(0)
    expect(visibleItems.length).toBeLessThanOrEqual(10) // Should only render visible items
  })

  it("shows loading state when isLoading is true", () => {
    const loadingComponent = <div data-testid="loading">Loading...</div>

    render(<VirtualScrollList
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        renderItem={(item, index) => <MockItem item={item} index={index} />}
        isLoading={true}
        loadingState={loadingComponent}
      />)

    expect(screen.getByTestId("loading")).toBeInTheDocument()
  })

  it("shows empty state when no items", () => {
    const emptyComponent = <div data-testid="empty">No items found</div>

    render(<VirtualScrollList
        items={[]}
        itemHeight={50}
        containerHeight={200}
        renderItem={(item, index) => <MockItem item={item} index={index} />}
        emptyState={emptyComponent}
      />)

    expect(screen.getByTestId("empty")).toBeInTheDocument()
  })

  it("shows default empty message when no items and no empty state", () => {
    render(<VirtualScrollList
        items={[]}
        itemHeight={50}
        containerHeight={200}
        renderItem={(item, index) => <MockItem item={item} index={index} />}
      />)

    expect(screen.getByText("No items to display")).toBeInTheDocument()
  })

  it("applies custom className to items", () => {
    const { container } = render(<VirtualScrollList
        items={mockItems.slice(0, 5)}
        itemHeight={50}
        containerHeight={200}
        renderItem={(item, index) => <MockItem item={item} index={index} />}
        itemClassName="custom-item-class"
      />)

    const items = container.querySelectorAll(".custom-item-class")
    expect(items.length).toBeGreaterThan(0)
  })

  it("applies custom className to list container", () => {
    const { container } = render(<VirtualScrollList
        items={mockItems.slice(0, 5)}
        itemHeight={50}
        containerHeight={200}
        renderItem={(item, index) => <MockItem item={item} index={index} />}
        listClassName="custom-list-class"
      />)

    expect(container.firstChild).toHaveClass("custom-list-class")
  })
})
