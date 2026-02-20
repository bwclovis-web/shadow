import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import TabContainer from "./TabContainer"
import TabItem from "./TabItem/TabItem"

const getTabItems = () => [
  <TabItem key="tab1" label="Tab 1" content={<div>Content 1</div>} />,
  <TabItem key="tab2" label="Tab 2" content={<div>Content 2</div>} />,
  <TabItem key="tab3" label="Tab 3" content={<div>Content 3</div>} />,
]

describe("TabContainer", () => {
  it("renders all tab labels", () => {
    render(<TabContainer>{getTabItems()}</TabContainer>)
    expect(screen.getByText("Tab 1")).toBeInTheDocument()
    expect(screen.getByText("Tab 2")).toBeInTheDocument()
    expect(screen.getByText("Tab 3")).toBeInTheDocument()
  })

  it("shows only the first tab panel by default", () => {
    render(<TabContainer>{getTabItems()}</TabContainer>)
    expect(screen.getByText("Content 1")).toBeVisible()
    expect(screen.queryByText("Content 2")).not.toBeVisible()
    expect(screen.queryByText("Content 3")).not.toBeVisible()
  })

  it("switches tab panel on tab click", () => {
    render(<TabContainer>{getTabItems()}</TabContainer>)
    fireEvent.click(screen.getByText("Tab 2"))
    expect(screen.getByText("Content 2")).toBeVisible()
    expect(screen.queryByText("Content 1")).not.toBeVisible()
    expect(screen.queryByText("Content 3")).not.toBeVisible()
  })

  it("sets correct aria attributes for tabs and panels", () => {
    const { container } = render(<TabContainer>{getTabItems()}</TabContainer>)
    const tabs = container.querySelectorAll('[role="tab"]')
    const firstTab = tabs[0]
    expect(firstTab).toHaveAttribute("aria-selected", "true")
    expect(firstTab).toHaveAttribute("aria-controls", "panel-0")
    const panel = container.querySelector('[role="tabpanel"]')
    expect(panel).toHaveAttribute("aria-labelledby", "tab-0")
  })

  it("renders auxComponent if provided", () => {
    render(<TabContainer auxComponent={<div data-testid="aux">Aux</div>}>
        {getTabItems()}
      </TabContainer>)
    expect(screen.getByTestId("aux")).toBeInTheDocument()
  })
})
