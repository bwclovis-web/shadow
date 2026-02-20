import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import Select from "./Select"

describe("Select", () => {
  it("renders a select", () => {
    const selectData = [
      { id: "1", label: "Option 1", name: "option1" },
      { id: "2", label: "Option 2", name: "option2" },
    ]
    render(<Select selectId="test-select" selectData={selectData} label="Test Select" />)
    expect(screen.getByText("Test Select")).toBeInTheDocument()
  })
})
