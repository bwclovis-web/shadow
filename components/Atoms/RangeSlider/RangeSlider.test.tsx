import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import RangeSlider from "./RangeSlider"

describe("RangeSlider", () => {
  it("renders a range slider with default props", () => {
    render(<RangeSlider />)
    expect(screen.getByRole("slider")).toBeDefined()
  })

  it("renders with a label when provided", () => {
    render(<RangeSlider label="Volume" />)
    expect(screen.getByText("Volume")).toBeDefined()
  })

  it("displays the current value when label is provided", () => {
    render(<RangeSlider label="Volume" value={50} />)
    expect(screen.getByText("50ml")).toBeDefined()
  })

  it("calls onChange when value changes", () => {
    const handleChange = vi.fn()
    render(<RangeSlider onChange={handleChange} />)

    const slider = screen.getByRole("slider")
    fireEvent.keyDown(slider, { key: "ArrowRight" })

    expect(handleChange).toHaveBeenCalled()
  })

  it("handles keyboard navigation", () => {
    const handleChange = vi.fn()
    render(<RangeSlider value={50} onChange={handleChange} />)

    const slider = screen.getByRole("slider")
    fireEvent.keyDown(slider, { key: "ArrowRight" })

    expect(handleChange).toHaveBeenCalledWith(51)
  })

  it("respects min and max values", () => {
    render(<RangeSlider min={10} max={90} value={50} />)

    expect(screen.getByText("10")).toBeDefined()
    expect(screen.getByText("90")).toBeDefined()
  })

  it("disables interaction when disabled prop is true", () => {
    render(<RangeSlider disabled />)

    const slider = screen.getByRole("slider")
    expect(slider.getAttribute("aria-disabled")).toBe("true")
    expect(slider.getAttribute("tabindex")).toBe("-1")
  })
})
