import type { PropsWithChildren } from "react"
import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
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
import AdminNavigation from "./AdminNavigation"

describe("AdminNavigation", () => {
  it("renders a adminnavigation", () => {
    const user = { role: "admin" }
    renderWithProviders(<AdminNavigation user={user} />)
    // Component renders translation keys, check for the link by href instead
    expect(screen.getByRole("link", { name: /^create house$/i })).toBeInTheDocument()
  })
})
