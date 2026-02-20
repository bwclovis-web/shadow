import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Button } from "./Button"

describe("Button", () => {
  it("renders a button", () => {
    render(<Button>Test Button</Button>)
    expect(screen.getByText("Test Button")).toBeInTheDocument()
  })
})
