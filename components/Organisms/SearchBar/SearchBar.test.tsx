import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"

import SearchBar from "./SearchBar"

describe("SearchBar", () => {
  it("renders a searchbar", () => {
    render(<MemoryRouter>
        <SearchBar searchType="perfume" />
      </MemoryRouter>)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })
})
