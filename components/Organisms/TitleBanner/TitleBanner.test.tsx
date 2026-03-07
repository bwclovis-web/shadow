/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import TitleBanner from "./TitleBanner"

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="banner-image" />
  ),
}))

vi.mock("./TitleBannerAnimator", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}))

describe("TitleBanner", () => {
  it("renders a titlebanner", () => {
    render(
      <TitleBanner
        image="/test-image.jpg"
        heading="Test Heading"
        subheading="Test Subheading"
      />
    )
    expect(screen.getByText("Test Heading")).toBeTruthy()
  })
})
