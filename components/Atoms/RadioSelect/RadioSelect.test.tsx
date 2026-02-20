import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import RadioSelect from "./RadioSelect"

describe("RadioSelect", () => {
  it("renders a radioselect", () => {
    const data = [
      {
        id: "1",
        label: "Option 1",
        value: "option1",
        name: "test",
        defaultChecked: false,
      },
      {
        id: "2",
        label: "Option 2",
        value: "option2",
        name: "test",
        defaultChecked: true,
      },
    ]
    const handleRadioChange = () => {}
    render(<RadioSelect data={data} handleRadioChange={handleRadioChange} />)
    expect(screen.getByText("Option 1")).toBeInTheDocument()
    expect(screen.getByText("Option 2")).toBeInTheDocument()
  })
})
