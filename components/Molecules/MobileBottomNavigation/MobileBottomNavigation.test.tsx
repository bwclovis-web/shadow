import { screen } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockPathname = vi.fn(() => "/")

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
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
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/Molecules/DirectMessageUnread/DirectMessageUnreadProvider", () => ({
  useDirectMessageUnreadCount: () => 2,
}))

vi.mock("@/components/Molecules/UserAlertsProvider/UserAlertsProvider", () => ({
  useUserAlertsContext: () => ({ unreadCount: 1 }),
}))

import { renderWithProviders } from "@/test/utils/test-utils"
import MobileBottomNavigation from "./MobileBottomNavigation"

describe("MobileBottomNavigation", () => {
  const mockUser = {
    id: "user-1",
    username: "trader",
    role: "user",
  }

  beforeEach(() => {
    mockPathname.mockReturnValue("/")
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("renders exchange, messages, profile, and alerts", () => {
    renderWithProviders(<MobileBottomNavigation user={mockUser} />)

    expect(screen.getByText("Exchange")).toBeInTheDocument()
    expect(screen.getByText("Messages")).toBeInTheDocument()
    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(screen.getByText("Alerts")).toBeInTheDocument()
  })

  it("links to core routes for signed-in users", () => {
    renderWithProviders(<MobileBottomNavigation user={mockUser} />)

    expect(screen.getByRole("link", { name: /exchange/i })).toHaveAttribute(
      "href",
      "/the-exchange"
    )
    expect(screen.getByRole("link", { name: /messages/i })).toHaveAttribute(
      "href",
      "/messages"
    )
    expect(screen.getByRole("link", { name: /alerts/i })).toHaveAttribute(
      "href",
      expect.stringContaining("#user-alerts")
    )
  })

  it("applies mobile fixed bottom styling", () => {
    const { container } = renderWithProviders(<MobileBottomNavigation />)
    const wrapper = container.firstChild

    expect(wrapper).toHaveClass("md:hidden")
    expect(wrapper).toHaveClass("fixed")
    expect(wrapper).toHaveClass("bottom-0")
    expect(wrapper).toHaveClass("mobile-safe-bottom")
  })

  it("shows sign in when logged out", () => {
    renderWithProviders(<MobileBottomNavigation user={null} />)
    expect(screen.getByText("Sign in")).toBeInTheDocument()
  })
})
