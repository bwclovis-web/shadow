import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MdInfoOutline } from "react-icons/md"

import IconPopover from "./IconPopover"

describe("IconPopover", () => {
  it("renders trigger and popover panel", () => {
    const { container } = render(
      <IconPopover
        ariaLabel="More info"
        icon={<MdInfoOutline data-testid="trigger-icon" size={20} />}
      >
        <p>Help text</p>
      </IconPopover>
    )

    expect(screen.getByRole("button", { name: "More info" })).toBeInTheDocument()
    expect(screen.getByTestId("trigger-icon")).toBeInTheDocument()
    expect(screen.getByText("Help text")).toBeInTheDocument()

    const panel = container.querySelector("[popover]")
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveAttribute("popover", "hint")
  })

  it("links button popovertarget to panel id", () => {
    const { container } = render(
      <IconPopover ariaLabel="Help" icon={<MdInfoOutline size={20} />}>
        Content
      </IconPopover>
    )

    const button = screen.getByRole("button", { name: "Help" })
    const panel = container.querySelector("[popover]")

    expect(panel?.id).toBeTruthy()
    expect(button.getAttribute("popovertarget")).toBe(panel?.id)
  })
})
