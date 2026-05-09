import type { PropsWithChildren } from "react"
import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock("next-view-transitions", () => ({
  useTransitionRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({
    children,
    href,
    className,
    ...rest
  }: PropsWithChildren<{ href: string; className?: string }>) => (
    <a href={typeof href === "string" ? href : "#"} className={className} {...rest}>
      {children}
    </a>
  ),
}))

import { renderWithProviders } from "@/test/utils/test-utils"
import GlobalNavigation from "./GlobalNavigation"

describe("GlobalNavigation", () => {
  it("renders a globalnavigation", () => {
    renderWithProviders(<GlobalNavigation />)
    expect(screen.getByText("Behind the Bottle")).toBeInTheDocument()
  })
})
