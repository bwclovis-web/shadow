import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FilterChipStrip } from "./FilterChipStrip"

afterEach(() => {
  cleanup()
})

describe("FilterChipStrip", () => {
  it("renders nothing when there are no chips and no clear action", () => {
    const { container } = render(
      <FilterChipStrip chips={[]} regionAriaLabel="Active filters" />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders chips with remove buttons and calls onRemove", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(
      <FilterChipStrip
        chips={[
          {
            id: "a",
            label: "Vanilla",
            removeAriaLabel: "Remove Vanilla",
            onRemove,
          },
        ]}
        regionAriaLabel="Active filters"
      />
    )

    expect(screen.getByRole("region", { name: "Active filters" })).toBeTruthy()
    expect(screen.getByText("Vanilla")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Remove Vanilla" }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("calls onClearAll when clear button is used", async () => {
    const user = userEvent.setup()
    const onClearAll = vi.fn()
    render(
      <FilterChipStrip
        chips={[
          {
            id: "a",
            label: "X",
            removeAriaLabel: "Remove X",
            onRemove: vi.fn(),
          },
        ]}
        regionAriaLabel="Filters"
        onClearAll={onClearAll}
        clearAllLabel="Clear all"
      />
    )

    await user.click(screen.getByRole("button", { name: "Clear all" }))
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })
})
