import { fireEvent, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"

import TagSearch from "./TagSearch"

describe("TagSearch", () => {
  it("renders a tagsearch", () => {
    const inputRef = createRef<HTMLInputElement>()
    const data = []
    const onChange = () => {}
    render(<TagSearch data={data} onChange={onChange} label="Test Tags" />)
    expect(screen.getByText("Test Tags search")).toBeInTheDocument()
  })

  it("renders selected tags with remove buttons", () => {
    const data = [
      { id: "1", name: "Vanilla" },
      { id: "2", name: "Rose" },
    ]
    const onChange = () => {}
    render(<TagSearch data={data} onChange={onChange} label="Test Tags" />)

    expect(screen.getByText("Vanilla")).toBeInTheDocument()
    expect(screen.getByText("Rose")).toBeInTheDocument()
    expect(screen.getAllByText("×")).toHaveLength(2)
  })

  it("calls onChange when a tag is removed", () => {
    const data = [
      { id: "1", name: "Vanilla" },
      { id: "2", name: "Rose" },
    ]
    const onChange = vi.fn()
    render(<TagSearch data={data} onChange={onChange} label="Test Tags" />)

    const removeButtons = screen.getAllByText("×")
    fireEvent.click(removeButtons[0])

    expect(onChange).toHaveBeenCalledWith([{ id: "2", name: "Rose" }])
  })
})
