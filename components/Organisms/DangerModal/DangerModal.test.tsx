import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import DangerModal from "./DangerModal"

// Default props for DangerModal
const defaultProps = {
  heading: "Are you sure you want to Remove?",
  description: "Once Removed you will lose all history, notes and entries in the exchange",
  action: vi.fn(),
}

describe("DangerModal", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders the danger modal", () => {
      render(<DangerModal {...defaultProps} />)
      expect(screen.getByText("Are you sure you want to Remove?")).toBeInTheDocument()
    })

    it("renders the warning message", () => {
      render(<DangerModal {...defaultProps} />)
      expect(screen.getByText(/Once Removed you will lose all history/)).toBeInTheDocument()
    })

    it("renders complete warning text", () => {
      render(<DangerModal {...defaultProps} />)
      const warningText = screen.getByText(/Once Removed you will lose all history, notes and entries in the exchange/)
      expect(warningText).toBeInTheDocument()
    })
  })

  describe("Button Action", () => {
    it("renders the remove button", () => {
      render(<DangerModal {...defaultProps} />)
      expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
    })

    it("calls action when button is clicked", () => {
      const action = vi.fn()
      render(<DangerModal {...defaultProps} action={action} />)
      const button = screen.getByRole("button", { name: /remove/i })
      button.click()
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  describe("Styling", () => {
    it("applies centered text class", () => {
      const { container } = render(<DangerModal {...defaultProps} />)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("text-center")
    })

    it("applies auto margin class", () => {
      const { container } = render(<DangerModal {...defaultProps} />)
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass("mx-auto")
    })

    it("has h2 element for title", () => {
      render(<DangerModal {...defaultProps} />)
      const title = screen.getByRole("heading", { level: 2 })
      expect(title).toHaveTextContent("Are you sure you want to Remove?")
    })

    it("applies noir color classes to warning text", () => {
      const { container } = render(<DangerModal {...defaultProps} />)
      const warningP = container.querySelector(".text-noir-gold-100")
      expect(warningP).toBeInTheDocument()
    })

    it("applies text-xl to warning text", () => {
      const { container } = render(<DangerModal {...defaultProps} />)
      const warningP = container.querySelector(".text-xl")
      expect(warningP).toBeInTheDocument()
    })

    it("applies mt-4 to button", () => {
      const { container } = render(<DangerModal {...defaultProps} />)
      const button = container.querySelector("button.mt-4")
      expect(button).toBeInTheDocument()
    })
  })

  describe("Structure", () => {
    it("has correct HTML structure", () => {
      const { container } = render(<DangerModal {...defaultProps} />)

      const wrapper = container.firstChild
      expect(wrapper).toBeInstanceOf(HTMLDivElement)

      const h2 = container.querySelector("h2")
      expect(h2).toBeInTheDocument()

      const p = container.querySelector("p")
      expect(p).toBeInTheDocument()

      const button = container.querySelector("button")
      expect(button).toBeInTheDocument()
    })

    it("maintains proper order: title, warning, button", () => {
      const { container } = render(<DangerModal {...defaultProps} />)

      const elements = container.querySelectorAll("h2, p, button")
      expect(elements.length).toBe(3)

      // Verify order
      expect(elements[0].tagName).toBe("H2")
      expect(elements[1].tagName).toBe("P")
      expect(elements[2].tagName).toBe("BUTTON")
    })
  })

  describe("Text Content", () => {
    it("displays correct title text", () => {
      render(<DangerModal {...defaultProps} />)
      expect(screen.getByText("Are you sure you want to Remove?")).toBeInTheDocument()
    })

    it("uses proper capitalization in title", () => {
      render(<DangerModal {...defaultProps} />)
      const title = screen.getByRole("heading")
      expect(title).toHaveTextContent(/Remove/)
    })

    it("displays complete warning about data loss", () => {
      render(<DangerModal {...defaultProps} />)
      const warning = screen.getByText(/lose all history/)
      expect(warning).toHaveTextContent("history")
      expect(warning).toHaveTextContent("notes")
      expect(warning).toHaveTextContent("entries")
      expect(warning).toHaveTextContent("exchange")
    })
  })

  describe("Accessibility", () => {
    it("has semantic heading for title", () => {
      render(<DangerModal {...defaultProps} />)
      const heading = screen.getByRole("heading", { level: 2 })
      expect(heading).toBeInTheDocument()
    })

    it("provides clear warning message", () => {
      render(<DangerModal {...defaultProps} />)
      const warning = screen.getByText(/Once Removed/)
      expect(warning).toBeInTheDocument()
      expect(warning.tagName).toBe("P")
    })

    it("uses semantic HTML elements", () => {
      const { container } = render(<DangerModal {...defaultProps} />)

      expect(container.querySelector("h2")).toBeInTheDocument()
      expect(container.querySelector("p")).toBeInTheDocument()
      expect(container.querySelector("button")).toBeInTheDocument()
    })
  })

  describe("Edge Cases", () => {
    it("renders with custom heading", () => {
      render(<DangerModal {...defaultProps} heading="Custom Heading" />)
      expect(screen.getByText("Custom Heading")).toBeInTheDocument()
    })

    it("renders with custom description", () => {
      render(<DangerModal {...defaultProps} description="Custom description text" />)
      expect(screen.getByText("Custom description text")).toBeInTheDocument()
    })

    it("handles empty heading", () => {
      render(<DangerModal {...defaultProps} heading="" />)
      const heading = screen.getByRole("heading", { level: 2 })
      expect(heading).toHaveTextContent("")
    })

    it("handles empty description", () => {
      const { container } = render(<DangerModal {...defaultProps} description="" />)
      const description = container.querySelector("p.text-noir-gold-100.text-xl")
      expect(description).toBeInTheDocument()
      expect(description).toHaveTextContent("")
    })
  })

  describe("Use Cases", () => {
    it("renders with default remove button", () => {
      render(<DangerModal {...defaultProps} />)
      expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
    })

    it("calls action function on button click", () => {
      const action = vi.fn()
      render(<DangerModal {...defaultProps} action={action} />)
      const button = screen.getByRole("button", { name: /remove/i })
      button.click()
      expect(action).toHaveBeenCalledTimes(1)
    })

    it("renders with different heading and description", () => {
      render(<DangerModal
          heading="Delete Account?"
          description="This will permanently delete your account"
          action={vi.fn()}
        />)
      expect(screen.getByText("Delete Account?")).toBeInTheDocument()
      expect(screen.getByText("This will permanently delete your account")).toBeInTheDocument()
    })
  })

  describe("Layout", () => {
    it("centers content horizontally and vertically", () => {
      const { container } = render(<DangerModal {...defaultProps} />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass("text-center")
      expect(wrapper).toHaveClass("mx-auto")
    })

    it("maintains consistent spacing for button", () => {
      const { container } = render(<DangerModal {...defaultProps} />)

      const button = container.querySelector("button.mt-4")
      expect(button).toBeInTheDocument()
    })
  })

  describe("Visual Hierarchy", () => {
    it("title is more prominent than warning text", () => {
      const { container } = render(<DangerModal {...defaultProps} />)

      const title = container.querySelector("h2")
      const warning = container.querySelector("p")

      expect(title?.tagName).toBe("H2")
      expect(warning?.tagName).toBe("P")
    })

    it("applies appropriate text sizing", () => {
      const { container } = render(<DangerModal {...defaultProps} />)

      const warning = container.querySelector(".text-xl")
      expect(warning).toBeInTheDocument()
    })

    it("uses color to indicate warning severity", () => {
      const { container } = render(<DangerModal {...defaultProps} />)

      const warning = container.querySelector(".text-noir-gold-100")
      expect(warning).toBeInTheDocument()
    })
  })

  describe("Component Integration", () => {
    it("works as part of a modal system", () => {
      render(<div className="modal">
          <DangerModal {...defaultProps} />
        </div>)

      expect(screen.getByText("Are you sure you want to Remove?")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
    })

    it("integrates with button styling", () => {
      const { container } = render(<DangerModal {...defaultProps} />)
      const button = container.querySelector("button")
      expect(button).toHaveClass("bg-red-500")
      expect(button).toHaveClass("animate-pulse")
    })
  })
})
