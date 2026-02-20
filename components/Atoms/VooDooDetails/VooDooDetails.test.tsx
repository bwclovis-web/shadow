import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import VooDooDetails from "./VooDooDetails"

describe("VooDooDetails", () => {
  it("renders a voodoodetails", () => {
    render(<VooDooDetails />)
    expect(screen.getByText("VooDoo Details")).toBeInTheDocument()
  })
})
