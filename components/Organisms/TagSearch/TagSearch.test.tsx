import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next-view-transitions", () => ({
  useTransitionRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({
    children,
    href,
    ...rest
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import TagSearch from "./TagSearch"

afterEach(() => {
  cleanup()
})

describe("TagSearch", () => {
  it("renders a tagsearch", () => {
    const data: { id: string; name: string }[] = []
    const onChange = () => {}
    render(<TagSearch data={data} onChange={onChange} label="Test Tags" />)
    expect(screen.getByText("Test Tags search")).toBeTruthy()
  })

  it("renders selected tags with remove buttons", () => {
    const data = [
      { id: "1", name: "Vanilla" },
      { id: "2", name: "Rose" },
    ]
    const onChange = () => {}
    render(<TagSearch data={data} onChange={onChange} label="Test Tags" />)

    expect(screen.getByText("Vanilla")).toBeTruthy()
    expect(screen.getByText("Rose")).toBeTruthy()
    expect(screen.getByTitle("Remove Vanilla")).toBeTruthy()
    expect(screen.getByTitle("Remove Rose")).toBeTruthy()
  })

  it("calls onChange when a tag is removed", () => {
    const data = [
      { id: "1", name: "Vanilla" },
      { id: "2", name: "Rose" },
    ]
    const onChange = vi.fn()
    render(<TagSearch data={data} onChange={onChange} label="Test Tags" />)

    fireEvent.click(screen.getByTitle("Remove Vanilla"))

    expect(onChange).toHaveBeenCalledWith([{ id: "2", name: "Rose" }])
  })
})
