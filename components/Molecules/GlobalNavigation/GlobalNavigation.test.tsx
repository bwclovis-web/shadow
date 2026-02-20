import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "../../../../test/utils/test-utils"
import GlobalNavigation from "./GlobalNavigation"

describe("GlobalNavigation", () => {
  it("renders a globalnavigation", () => {
    renderWithProviders(<GlobalNavigation />)
    expect(screen.getByText("Behind the Bottle")).toBeInTheDocument()
  })
})
