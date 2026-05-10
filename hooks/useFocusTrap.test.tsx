import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef } from "react"
import { describe, expect, it } from "vitest"

import { getTabbableElements, useFocusTrap } from "./useFocusTrap"

const TrapFixture = () => {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, { active: true })
  return (
    <div ref={ref}>
      <button type="button">first</button>
      <button type="button">last</button>
    </div>
  )
}

describe("getTabbableElements", () => {
  it("returns buttons in document order", () => {
    const container = document.createElement("div")
    container.innerHTML = `
      <button type="button">A</button>
      <button type="button">B</button>
    `
    const tabbable = getTabbableElements(container)
    expect(tabbable).toHaveLength(2)
    expect(tabbable[0]).toHaveTextContent("A")
    expect(tabbable[1]).toHaveTextContent("B")
  })

  it("excludes disabled buttons", () => {
    const container = document.createElement("div")
    container.innerHTML = `<button type="button" disabled>Off</button><button type="button">On</button>`
    const tabbable = getTabbableElements(container)
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toHaveTextContent("On")
  })
})

describe("useFocusTrap", () => {
  it("wraps Tab from last to first focusable", async () => {
    const user = userEvent.setup()
    render(<TrapFixture />)
    const first = screen.getByRole("button", { name: "first" })
    const last = screen.getByRole("button", { name: "last" })
    expect(document.activeElement).toBe(first)
    await user.tab()
    expect(document.activeElement).toBe(last)
    await user.tab()
    expect(document.activeElement).toBe(first)
  })

  it("wraps Shift+Tab from first to last focusable", async () => {
    const user = userEvent.setup()
    render(<TrapFixture />)
    const first = screen.getByRole("button", { name: "first" })
    const last = screen.getByRole("button", { name: "last" })
    first.focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(last)
  })
})
