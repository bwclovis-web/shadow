import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/utils/test-utils"

import LogoutButton from "./LogoutButton"

describe("LogoutButton", () => {
  it("renders a logoutbutton", () => {
    renderWithProviders(<LogoutButton />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })
})
