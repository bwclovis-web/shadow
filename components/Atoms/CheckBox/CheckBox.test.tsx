import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import CheckBox from "./CheckBox"

describe("CheckBox", () => {
  it("renders a checkbox", () => {
    render(<CheckBox label="Ford Prefect" />)
    expect(screen.getByText("Ford Prefect")).toBeInTheDocument()
  })
})
