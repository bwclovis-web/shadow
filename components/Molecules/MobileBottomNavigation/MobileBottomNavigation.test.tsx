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

vi.mock("@/components/Molecules/UserAlertsProvider/UserAlertsProvider", () => ({
  useDirectMessageUnreadCount: () => 2,
  useUserAlertsContext: () => ({ unreadCount: 1 }),
}))

import { SignupAvailabilityProvider } from "@/components/Containers/SignupAvailability"
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
      "/exchanges"
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

  it("shows join free linking to sign-up while founding spots remain", () => {
    renderWithProviders(
      <SignupAvailabilityProvider
        availability={{ freeOpen: true, spotsLeft: 95, limit: 100 }}
      >
        <MobileBottomNavigation user={null} />
      </SignupAvailabilityProvider>
    )
    expect(screen.getByRole("link", { name: /join free/i })).toHaveAttribute(
      "href",
      "/sign-up"
    )
  })

  it("shows join linking to membership once founding spots are gone", () => {
    renderWithProviders(
      <SignupAvailabilityProvider
        availability={{ freeOpen: false, spotsLeft: 0, limit: 100 }}
      >
        <MobileBottomNavigation user={null} />
      </SignupAvailabilityProvider>
    )
    expect(screen.getByRole("link", { name: /^join$/i })).toHaveAttribute(
      "href",
      "/membership"
    )
  })
})
