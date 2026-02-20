import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import TabItem from "./TabItem"

describe("TabItem", () => {
  it("renders the label and content", () => {
    render(<TabItem label="Tab 1" content={<div>Tab Content</div>} />)
    expect(screen.getByText("Tab 1")).toBeInTheDocument()
    expect(screen.getByText("Tab Content")).toBeInTheDocument()
  })

  it("renders with different content types", () => {
    render(<TabItem label="Tab 2" content={<span>Another Content</span>} />)
    expect(screen.getByText("Tab 2")).toBeInTheDocument()
    expect(screen.getByText("Another Content")).toBeInTheDocument()
  })

  it("renders when content is a string", () => {
    render(<TabItem label="Tab 3" content="String Content" />)
    expect(screen.getByText("Tab 3")).toBeInTheDocument()
    expect(screen.getByText("String Content")).toBeInTheDocument()
  })
})
