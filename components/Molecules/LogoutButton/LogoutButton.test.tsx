import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import LogoutButton from "./LogoutButton"

describe("LogoutButton", () => {
  it("renders a logoutbutton", () => {
    render(<LogoutButton />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })
})
