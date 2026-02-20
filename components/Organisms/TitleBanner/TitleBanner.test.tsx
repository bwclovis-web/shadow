import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import TitleBanner from "./TitleBanner"

describe("TitleBanner", () => {
  it("renders a titlebanner", () => {
    render(<TitleBanner
        image="/test-image.jpg"
        heading="Test Heading"
        subheading="Test Subheading"
      />)
    expect(screen.getByText("Test Heading")).toBeInTheDocument()
  })
})
