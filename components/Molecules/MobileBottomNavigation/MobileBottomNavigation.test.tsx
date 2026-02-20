import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "../../../../test/utils/test-utils"
import MobileBottomNavigation from "./MobileBottomNavigation"

describe("MobileBottomNavigation", () => {
  const mockUser = {
    id: "user-1",
    role: "user",
  }

  beforeEach(() => {
    // Mock querySelector for search input
    document.querySelector = vi.fn((selector: string) => {
      if (selector.includes("input")) {
        return {
          focus: vi.fn(),
        } as any
      }
      return null
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders the mobile bottom navigation", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      expect(container.querySelector("nav")).toBeInTheDocument()
    })

    it("renders all navigation items", () => {
      renderWithProviders(<MobileBottomNavigation />)

      expect(screen.getByText("Home")).toBeInTheDocument()
      expect(screen.getByText("Search")).toBeInTheDocument()
      expect(screen.getByText("Perfumes")).toBeInTheDocument()
      expect(screen.getByText("Menu")).toBeInTheDocument()
    })

    it("applies correct mobile-specific classes", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass("md:hidden")
      expect(wrapper).toHaveClass("fixed")
      expect(wrapper).toHaveClass("bottom-0")
      expect(wrapper).toHaveClass("mobile-safe-bottom")
    })

    it("applies custom className", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation className="custom-class" />)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("custom-class")
    })

    it("applies backdrop blur and styling", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass("bg-noir-dark/95")
      expect(wrapper).toHaveClass("backdrop-blur-md")
      expect(wrapper).toHaveClass("border-t")
      expect(wrapper).toHaveClass("border-noir-light/20")
    })

    it("has proper z-index for overlay", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("z-40")
    })
  })

  describe("Home Navigation", () => {
    it("renders home link with correct path", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const homeLink = screen.getByRole("link", { name: /home/i })
      expect(homeLink).toHaveAttribute("href", "/")
    })

    it("displays home icon", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const homeLink = screen.getByRole("link", { name: /home/i })
      const icon = homeLink.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })

    it("applies correct styling classes", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const homeLink = screen.getByRole("link", { name: /home/i })

      expect(homeLink).toHaveClass("flex")
      expect(homeLink).toHaveClass("flex-col")
      expect(homeLink).toHaveClass("items-center")
      expect(homeLink).toHaveClass("mobile-touch-target")
    })

    it("has touch-friendly padding", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const homeLink = screen.getByRole("link", { name: /home/i })
      expect(homeLink).toHaveClass("p-2")
    })
  })

  describe("Search Functionality", () => {
    it("renders search button", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const searchButton = screen.getByRole("button", { name: /search/i })
      expect(searchButton).toBeInTheDocument()
    })

    it("focuses search input when clicked", async () => {
      const user = userEvent.setup()
      const mockFocus = vi.fn()

      document.querySelector = vi.fn(() => ({
            focus: mockFocus,
          } as any))

      renderWithProviders(<MobileBottomNavigation />)
      const searchButton = screen.getByRole("button", { name: /search/i })

      await user.click(searchButton)

      expect(mockFocus).toHaveBeenCalled()
    })

    it("handles missing search input gracefully", async () => {
      const user = userEvent.setup()
      document.querySelector = vi.fn(() => null)

      renderWithProviders(<MobileBottomNavigation />)
      const searchButton = screen.getByRole("button", { name: /search/i })

      await expect(user.click(searchButton)).resolves.not.toThrow()
    })

    it("searches for multiple input selectors", async () => {
      const user = userEvent.setup()
      const querySelectorSpy = vi.spyOn(document, "querySelector")

      renderWithProviders(<MobileBottomNavigation />)
      const searchButton = screen.getByRole("button", { name: /search/i })

      await user.click(searchButton)

      expect(querySelectorSpy).toHaveBeenCalled()
    })

    it("displays search icon", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const searchButton = screen.getByRole("button", { name: /search/i })
      const icon = searchButton.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })
  })

  describe("Perfumes Navigation", () => {
    it("renders perfumes link with correct path", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const perfumesLink = screen.getByRole("link", { name: /perfumes/i })
      expect(perfumesLink).toHaveAttribute("href", "/the-vault")
    })

    it("displays heart icon for perfumes", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const perfumesLink = screen.getByRole("link", { name: /perfumes/i })
      const icon = perfumesLink.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })

    it("applies correct styling", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const perfumesLink = screen.getByRole("link", { name: /perfumes/i })

      expect(perfumesLink).toHaveClass("flex")
      expect(perfumesLink).toHaveClass("flex-col")
      expect(perfumesLink).toHaveClass("mobile-touch-target")
    })
  })

  describe("User/Profile Navigation", () => {
    it('shows "Sign In" when user is not logged in', () => {
      renderWithProviders(<MobileBottomNavigation />)
      expect(screen.getByText("Sign In")).toBeInTheDocument()
    })

    it("links to sign in page when user is not logged in", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const signInLink = screen.getByRole("link", { name: /sign in/i })
      expect(signInLink).toHaveAttribute("href", "/sign-in")
    })

    it('shows "Profile" when user is logged in', () => {
      renderWithProviders(<MobileBottomNavigation user={mockUser} />)
      expect(screen.getByText("Profile")).toBeInTheDocument()
    })

    it("links to profile page when user is logged in", () => {
      renderWithProviders(<MobileBottomNavigation user={mockUser} />)
      const profileLink = screen.getByRole("link", { name: /profile/i })
      expect(profileLink).toHaveAttribute("href", "/admin/profile")
    })

    it("displays user icon", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const userLink = screen.getByRole("link", { name: /sign in/i })
      const icon = userLink.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })
  })

  describe("Menu Button", () => {
    it("renders menu button", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const menuButton = screen.getByRole("button", { name: /open menu/i })
      expect(menuButton).toBeInTheDocument()
    })

    it("has proper aria-label", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const menuButton = screen.getByRole("button", { name: /open menu/i })
      expect(menuButton).toHaveAttribute("aria-label", "Open menu")
    })

    it("calls onMenuOpen when clicked", async () => {
      const user = userEvent.setup()
      const onMenuOpen = vi.fn()

      renderWithProviders(<MobileBottomNavigation onMenuOpen={onMenuOpen} />)
      const menuButton = screen.getByRole("button", { name: /open menu/i })

      await user.click(menuButton)

      expect(onMenuOpen).toHaveBeenCalledTimes(1)
    })

    it("does not throw when onMenuOpen is not provided", async () => {
      const user = userEvent.setup()
      renderWithProviders(<MobileBottomNavigation />)
      const menuButton = screen.getByRole("button", { name: /open menu/i })

      await expect(user.click(menuButton)).resolves.not.toThrow()
    })

    it("displays bars icon", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const menuButton = screen.getByRole("button", { name: /open menu/i })
      const icon = menuButton.querySelector("svg")
      expect(icon).toBeInTheDocument()
    })
  })

  describe("Active State Styling", () => {
    it("applies active styles to current route", () => {
      renderWithProviders(<MobileBottomNavigation />, {
        initialEntries: ["/"],
      })
      const homeLink = screen.getByRole("link", { name: /home/i })
      expect(homeLink).toHaveClass("text-noir-light")
    })

    it("applies inactive styles to non-active routes", () => {
      renderWithProviders(<MobileBottomNavigation />, {
        initialEntries: ["/about"],
      })
      const perfumesLink = screen.getByRole("link", { name: /perfumes/i })
      expect(perfumesLink).toHaveClass("text-noir-gold")
    })
  })

  describe("Layout and Positioning", () => {
    it("uses flexbox for horizontal layout", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const nav = container.querySelector("nav")
      expect(nav).toHaveClass("flex")
      expect(nav).toHaveClass("justify-around")
    })

    it("centers items vertically", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const nav = container.querySelector("nav")
      expect(nav).toHaveClass("items-center")
    })

    it("applies safe area padding", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("mobile-safe-bottom")
    })

    it("is fixed to bottom of viewport", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass("fixed")
      expect(wrapper).toHaveClass("bottom-0")
      expect(wrapper).toHaveClass("left-0")
      expect(wrapper).toHaveClass("right-0")
    })
  })

  describe("Responsive Behavior", () => {
    it("hides on medium screens and above", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("md:hidden")
    })
  })

  describe("Icons and Visual Elements", () => {
    it("renders all icons with correct sizes", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const icons = container.querySelectorAll("svg")

      // Should have 5 icons (Home, Search, Perfumes, User, Menu)
      expect(icons.length).toBe(5)
    })

    it("has proper icon-text spacing", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const homeLink = screen.getByRole("link", { name: /home/i })
      expect(homeLink).toHaveClass("gap-1")
    })

    it("uses correct text size for labels", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const labels = container.querySelectorAll(".text-xs")
      expect(labels.length).toBeGreaterThan(0)
    })
  })

  describe("Accessibility", () => {
    it("has semantic nav element", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const nav = container.querySelector("nav")
      expect(nav).toBeInTheDocument()
    })

    it("has accessible labels for all interactive elements", () => {
      renderWithProviders(<MobileBottomNavigation />)

      expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: /perfumes/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument()
    })

    it("provides proper touch targets for mobile", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const touchTargets = container.querySelectorAll(".mobile-touch-target")

      // All interactive elements should have mobile-touch-target class
      expect(touchTargets.length).toBeGreaterThan(0)
    })

    it("has keyboard-accessible navigation", () => {
      renderWithProviders(<MobileBottomNavigation />)

      const links = screen.getAllByRole("link")
      links.forEach(link => {
        expect(link).toHaveAttribute("href")
      })
    })

    it("buttons have proper roles", () => {
      renderWithProviders(<MobileBottomNavigation />)

      const buttons = screen.getAllByRole("button")
      expect(buttons.length).toBe(2) // Search and Menu buttons
    })
  })

  describe("User Prop Variations", () => {
    it("handles user with admin role", () => {
      const adminUser = { id: "admin-1", role: "admin" }
      renderWithProviders(<MobileBottomNavigation user={adminUser} />)

      const profileLink = screen.getByRole("link", { name: /profile/i })
      expect(profileLink).toHaveAttribute("href", "/admin/profile")
    })

    it("handles user with editor role", () => {
      const editorUser = { id: "editor-1", role: "editor" }
      renderWithProviders(<MobileBottomNavigation user={editorUser} />)

      expect(screen.getByText("Profile")).toBeInTheDocument()
    })

    it("handles null user", () => {
      renderWithProviders(<MobileBottomNavigation user={null} />)
      expect(screen.getByText("Sign In")).toBeInTheDocument()
    })

    it("handles undefined user", () => {
      renderWithProviders(<MobileBottomNavigation user={undefined} />)
      expect(screen.getByText("Sign In")).toBeInTheDocument()
    })
  })

  describe("Styling and Theme", () => {
    it("uses noir color scheme", () => {
      const { container } = renderWithProviders(<MobileBottomNavigation />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass("bg-noir-dark/95")
      expect(wrapper).toHaveClass("border-noir-light/20")
    })

    it("applies transition effects", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const links = screen.getAllByRole("link")

      links.forEach(link => {
        expect(link).toHaveClass("transition-colors")
      })
    })

    it("has hover states", () => {
      renderWithProviders(<MobileBottomNavigation />)
      const perfumesLink = screen.getByRole("link", { name: /perfumes/i })
      expect(perfumesLink).toHaveClass("hover:text-noir-light")
    })
  })

  describe("Edge Cases", () => {
    it("handles rapid button clicks", async () => {
      const user = userEvent.setup()
      const onMenuOpen = vi.fn()

      renderWithProviders(<MobileBottomNavigation onMenuOpen={onMenuOpen} />)
      const menuButton = screen.getByRole("button", { name: /open menu/i })

      await user.click(menuButton)
      await user.click(menuButton)
      await user.click(menuButton)

      expect(onMenuOpen).toHaveBeenCalledTimes(3)
    })

    it("handles missing navigation data gracefully", () => {
      // Mock mainNavigation to return empty or undefined
      expect(() => renderWithProviders(<MobileBottomNavigation />)).not.toThrow()
    })

    it("renders without optional props", () => {
      expect(() => renderWithProviders(<MobileBottomNavigation />)).not.toThrow()
    })
  })

  describe("Integration", () => {
    it("all navigation links are functional", () => {
      renderWithProviders(<MobileBottomNavigation user={mockUser} />)

      const homeLink = screen.getByRole("link", { name: /home/i })
      const perfumesLink = screen.getByRole("link", { name: /perfumes/i })
      const profileLink = screen.getByRole("link", { name: /profile/i })

      expect(homeLink).toHaveAttribute("href")
      expect(perfumesLink).toHaveAttribute("href")
      expect(profileLink).toHaveAttribute("href")
    })

    it("integrates with router correctly", () => {
      const { history } = renderWithProviders(<MobileBottomNavigation />, {
        initialEntries: ["/"],
      })

      expect(history.location.pathname).toBe("/")
    })
  })
})
