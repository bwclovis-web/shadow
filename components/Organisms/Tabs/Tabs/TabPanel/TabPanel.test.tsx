import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import TabItem from "../TabItem/TabItem"
import TabPanel from "./TabPanel"

const getTabItem = (label: string, content: string) => (
  <TabItem label={label} content={content} />
)

describe("TabPanel", () => {
  it("renders the content of the child TabItem", () => {
    render(<TabPanel
        idx={0}
        child={getTabItem("Tab 1", "Panel Content")}
        activeTab={0}
        type="secondary"
      />)
    expect(screen.getByText("Panel Content")).toBeInTheDocument()
  })

  it("is hidden when not the active tab", () => {
    render(<TabPanel
        idx={1}
        child={getTabItem("Tab 2", "Hidden Content")}
        activeTab={0}
        type="secondary"
      />)
    const section = screen.getByRole("tabpanel", { hidden: true })
    expect(section).toHaveAttribute("hidden")
  })

  it("is visible when it is the active tab", () => {
    render(<TabPanel
        idx={2}
        child={getTabItem("Tab 3", "Visible Content")}
        activeTab={2}
        type="secondary"
      />)
    const section = screen.getByRole("tabpanel")
    expect(section).not.toHaveAttribute("hidden")
    expect(screen.getByText("Visible Content")).toBeInTheDocument()
  })

  it("sets correct aria-labelledby and id", () => {
    render(<TabPanel
        idx={3}
        child={getTabItem("Tab 4", "Aria Content")}
        activeTab={3}
        type="secondary"
      />)
    const section = screen.getByRole("tabpanel")
    expect(section).toHaveAttribute("aria-labelledby", "tab-3")
    expect(section).toHaveAttribute("id", "panel-3")
  })
})
