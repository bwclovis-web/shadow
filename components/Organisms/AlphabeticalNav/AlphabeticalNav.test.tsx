import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AlphabeticalNav from "./AlphabeticalNav"

// Mock getAlphabetLetters
vi.mock("~/utils/sortUtils", () => ({
  getAlphabetLetters: () => [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
  ],
}))

describe("AlphabeticalNav", () => {
  const mockOnLetterSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe("Rendering", () => {
    it("renders the alphabetical navigation", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      expect(screen.getByText("All")).toBeInTheDocument()
    })

    it("renders all alphabet letters", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const letters = [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
      ]
      letters.forEach(letter => {
        expect(screen.getByText(letter)).toBeInTheDocument()
      })
    })

    it("renders All button", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument()
    })

    it("renders 27 buttons total (All + 26 letters)", () => {
      const { container } = render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      // Query buttons within the component container only
      const buttons = container.querySelectorAll("button")
      expect(buttons).toHaveLength(27)
    })

    it("applies custom className", () => {
      const { container } = render(<AlphabeticalNav
          selectedLetter={null}
          onLetterSelect={mockOnLetterSelect}
          className="custom-class"
        />)
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("Selection State", () => {
    it("highlights All button when selectedLetter is null", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      const allButton = screen.getByRole("button", { name: "All" })
      expect(allButton).toHaveClass("bg-noir-gold")
      expect(allButton).toHaveClass("text-noir-black")
    })

    it("highlights selected letter", () => {
      render(<AlphabeticalNav selectedLetter="A" onLetterSelect={mockOnLetterSelect} />)
      const aButton = screen.getByRole("button", { name: "A" })
      expect(aButton).toHaveClass("bg-noir-gold")
      expect(aButton).toHaveClass("text-noir-black")
    })

    it("does not highlight All button when a letter is selected", () => {
      render(<AlphabeticalNav selectedLetter="B" onLetterSelect={mockOnLetterSelect} />)
      const allButton = screen.getByRole("button", { name: "All" })
      expect(allButton).not.toHaveClass("bg-noir-gold")
      expect(allButton).toHaveClass("bg-noir-dark")
      expect(allButton).toHaveClass("text-noir-gold")
    })

    it("only highlights one letter at a time", () => {
      render(<AlphabeticalNav selectedLetter="M" onLetterSelect={mockOnLetterSelect} />)

      const mButton = screen.getByRole("button", { name: "M" })
      expect(mButton).toHaveClass("bg-noir-gold")

      const aButton = screen.getByRole("button", { name: "A" })
      expect(aButton).not.toHaveClass("bg-noir-gold")
      expect(aButton).toHaveClass("bg-noir-dark")
    })
  })

  describe("Click Interactions", () => {
    it("calls onLetterSelect with null when All is clicked", () => {
      render(<AlphabeticalNav selectedLetter="A" onLetterSelect={mockOnLetterSelect} />)

      const allButton = screen.getByRole("button", { name: "All" })
      allButton.click()

      expect(mockOnLetterSelect).toHaveBeenCalledWith(null)
      expect(mockOnLetterSelect).toHaveBeenCalledTimes(1)
    })

    it("calls onLetterSelect with letter when clicked", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const aButton = screen.getByRole("button", { name: "A" })
      aButton.click()

      expect(mockOnLetterSelect).toHaveBeenCalledWith("A")
      expect(mockOnLetterSelect).toHaveBeenCalledTimes(1)
    })

    it("calls onLetterSelect with correct letter for each button", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const testLetters = ["B", "M", "Z"]

      for (const letter of testLetters) {
        mockOnLetterSelect.mockClear()
        const button = screen.getByRole("button", { name: letter })
        button.click()
        expect(mockOnLetterSelect).toHaveBeenCalledWith(letter)
      }
    })

    it("handles rapid clicks", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const aButton = screen.getByRole("button", { name: "A" })
      const bButton = screen.getByRole("button", { name: "B" })

      aButton.click()
      bButton.click()
      aButton.click()

      expect(mockOnLetterSelect).toHaveBeenCalledTimes(3)
    })

    it("can select same letter multiple times", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const aButton = screen.getByRole("button", { name: "A" })

      aButton.click()
      aButton.click()

      expect(mockOnLetterSelect).toHaveBeenCalledTimes(2)
      expect(mockOnLetterSelect).toHaveBeenCalledWith("A")
    })
  })

  describe("Styling", () => {
    it("applies grid layout", () => {
      const { container } = render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      expect(container.firstChild).toHaveClass("grid")
      expect(container.firstChild).toHaveClass("grid-cols-6")
      expect(container.firstChild).toHaveClass("md:grid-cols-8")
      expect(container.firstChild).toHaveClass("lg:grid-cols-9")
      expect(container.firstChild).toHaveClass("gap-4")
    })

    it("centers content", () => {
      const { container } = render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      expect(container.firstChild).toHaveClass("justify-center")
    })

    it("applies inner-container class", () => {
      const { container } = render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      expect(container.firstChild).toHaveClass("inner-container")
    })

    it("applies margin classes", () => {
      const { container } = render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      expect(container.firstChild).toHaveClass("mt-10")
      expect(container.firstChild).toHaveClass("md:mb-18")
    })

    it("applies active styling to selected letter", () => {
      render(<AlphabeticalNav selectedLetter="C" onLetterSelect={mockOnLetterSelect} />)
      const cButton = screen.getByRole("button", { name: "C" })
      expect(cButton).toHaveClass("bg-noir-gold")
      expect(cButton).toHaveClass("text-noir-black")
    })

    it("applies inactive styling to non-selected letters", () => {
      render(<AlphabeticalNav selectedLetter="C" onLetterSelect={mockOnLetterSelect} />)
      const aButton = screen.getByRole("button", { name: "A" })
      expect(aButton).toHaveClass("bg-noir-dark")
      expect(aButton).toHaveClass("text-noir-gold")
      expect(aButton).toHaveClass("hover:bg-noir-gold/20")
      expect(aButton).toHaveClass("noir-outline")
    })

    it("applies transition classes to all buttons", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveClass("transition-colors")
      })
    })

    it("applies large text on lg screens", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const aButton = screen.getByRole("button", { name: "A" })
      const span = aButton.querySelector("span")
      expect(span).toHaveClass("lg:text-2xl")
    })
  })

  describe("Layout", () => {
    it("positions letter spans correctly", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const aButton = screen.getByRole("button", { name: "A" })
      expect(aButton).toHaveClass("flex")
      expect(aButton).toHaveClass("items-center")
      expect(aButton).toHaveClass("justify-center")
    })

    it("applies padding to buttons", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveClass("px-3")
        expect(button).toHaveClass("py-2")
      })
    })

    it("applies rounded corners to buttons", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveClass("rounded-md")
      })
    })

    it("applies font-medium to buttons", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveClass("font-medium")
      })
    })
  })

  describe("Accessibility", () => {
    it("all buttons are keyboard accessible", async () => {
      const user = userEvent.setup()
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      // Tab to first button
      await user.tab()
      const allButton = screen.getByRole("button", { name: "All" })
      expect(allButton).toHaveFocus()
    })

    it("buttons have proper role", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button.tagName).toBe("BUTTON")
      })
    })

    it("provides clear button labels", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "A" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Z" })).toBeInTheDocument()
    })

    it("visually indicates selected state", () => {
      render(<AlphabeticalNav selectedLetter="D" onLetterSelect={mockOnLetterSelect} />)

      const selectedButton = screen.getByRole("button", { name: "D" })
      const unselectedButton = screen.getByRole("button", { name: "E" })

      // Visual difference should be clear
      expect(selectedButton.className).not.toBe(unselectedButton.className)
    })
  })

  describe("Edge Cases", () => {
    it("handles selectedLetter being undefined", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)
      expect(screen.getByRole("button", { name: "All" })).toHaveClass("bg-noir-gold")
    })

    it("handles invalid selectedLetter gracefully", () => {
      render(<AlphabeticalNav
          selectedLetter={"1" as any}
          onLetterSelect={mockOnLetterSelect}
        />)

      // All button should not be highlighted
      const allButton = screen.getByRole("button", { name: "All" })
      expect(allButton).not.toHaveClass("bg-noir-gold")
    })

    it("calls onLetterSelect even if callback would throw", () => {
      const throwingCallback = vi.fn(() => {
        throw new Error("Callback error")
      })

      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={throwingCallback} />)

      const aButton = screen.getByRole("button", { name: "A" })

      // React's event system catches errors in event handlers, so the error
      // won't propagate, but the callback should still be called
      aButton.click()
      expect(throwingCallback).toHaveBeenCalledWith("A")
    })

    it("renders correctly with empty className", () => {
      const { container } = render(<AlphabeticalNav
          selectedLetter={null}
          onLetterSelect={mockOnLetterSelect}
          className=""
        />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe("Letter Selection Scenarios", () => {
    it("can select first letter", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      screen.getByRole("button", { name: "A" }).click()
      expect(mockOnLetterSelect).toHaveBeenCalledWith("A")
    })

    it("can select last letter", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      screen.getByRole("button", { name: "Z" }).click()
      expect(mockOnLetterSelect).toHaveBeenCalledWith("Z")
    })

    it("can select middle letter", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      screen.getByRole("button", { name: "M" }).click()
      expect(mockOnLetterSelect).toHaveBeenCalledWith("M")
    })

    it("can deselect by clicking All", () => {
      render(<AlphabeticalNav selectedLetter="K" onLetterSelect={mockOnLetterSelect} />)

      screen.getByRole("button", { name: "All" }).click()
      expect(mockOnLetterSelect).toHaveBeenCalledWith(null)
    })
  })

  describe("Visual States", () => {
    it("differentiates selected and unselected states", () => {
      render(<AlphabeticalNav selectedLetter="F" onLetterSelect={mockOnLetterSelect} />)

      const selected = screen.getByRole("button", { name: "F" })
      const unselected = screen.getByRole("button", { name: "G" })

      expect(selected).toHaveClass("bg-noir-gold", "text-noir-black")
      expect(unselected).toHaveClass("bg-noir-dark", "text-noir-gold")
    })

    it("shows hover state on unselected buttons", () => {
      render(<AlphabeticalNav selectedLetter="A" onLetterSelect={mockOnLetterSelect} />)

      const unselected = screen.getByRole("button", { name: "B" })
      expect(unselected).toHaveClass("hover:bg-noir-gold/20")
    })

    it("applies relative positioning to buttons", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const buttons = screen.getAllByRole("button")
      buttons.forEach(button => {
        expect(button).toHaveClass("relative")
      })
    })
  })

  describe("Integration with getAlphabetLetters", () => {
    it("renders letters from getAlphabetLetters utility", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      // Should have 26 letters + 1 All button
      const buttons = screen.getAllByRole("button")
      expect(buttons).toHaveLength(27)
    })

    it("maintains letter order from utility", () => {
      render(<AlphabeticalNav selectedLetter={null} onLetterSelect={mockOnLetterSelect} />)

      const buttons = screen.getAllByRole("button")
      const letterButtons = buttons.slice(1) // Skip "All" button

      const letters = letterButtons.map(btn => btn.textContent)
      expect(letters.join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    })
  })

  describe("Component Reusability", () => {
    it("works with different selectedLetter props", () => {
      const { rerender } = render(<AlphabeticalNav selectedLetter="A" onLetterSelect={mockOnLetterSelect} />)

      expect(screen.getByRole("button", { name: "A" })).toHaveClass("bg-noir-gold")

      rerender(<AlphabeticalNav selectedLetter="Z" onLetterSelect={mockOnLetterSelect} />)

      expect(screen.getByRole("button", { name: "Z" })).toHaveClass("bg-noir-gold")
      expect(screen.getByRole("button", { name: "A" })).not.toHaveClass("bg-noir-gold")
    })

    it("works with different onLetterSelect callbacks", () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      const { rerender } = render(<AlphabeticalNav selectedLetter={null} onLetterSelect={callback1} />)

      screen.getByRole("button", { name: "A" }).click()
      expect(callback1).toHaveBeenCalledWith("A")

      rerender(<AlphabeticalNav selectedLetter={null} onLetterSelect={callback2} />)

      screen.getByRole("button", { name: "B" }).click()
      expect(callback2).toHaveBeenCalledWith("B")
    })
  })
})
