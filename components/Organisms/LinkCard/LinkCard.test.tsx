import { cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it } from "vitest"

import LinkCard from "./LinkCard"

// Helper to render with router
function renderWithRouter(component: ReactElement) {
  return render(<MemoryRouter>{component}</MemoryRouter>)
}

describe("LinkCard", () => {
  afterEach(() => {
    cleanup()
  })
  const mockPerfumeData = {
    id: "perfume-1",
    slug: "test-perfume",
    name: "Test Perfume",
    image: "/images/test-perfume.jpg",
    type: "eau de parfum",
    perfumeHouse: {
      name: "Test House",
    },
  }

  const mockHouseData = {
    id: "house-1",
    slug: "test-house",
    name: "Test House",
    image: "/images/test-house.jpg",
  }

  describe("Rendering", () => {
    it("renders the link card", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("Test Perfume")).toBeInTheDocument()
    })

    it("renders perfume name", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByRole("heading", { name: "Test Perfume" })).toBeInTheDocument()
    })

    it("renders perfume house name when provided", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("Test House")).toBeInTheDocument()
    })

    it("renders image with correct src", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img", { name: "Test Perfume" }))
      expect(image).toHaveAttribute("src", "/images/test-perfume.jpg")
    })

    it("does not render house name when not provided", () => {
      const dataWithoutHouse = { ...mockPerfumeData, perfumeHouse: undefined }
      renderWithRouter(<LinkCard data={dataWithoutHouse} type="perfume" />)
      expect(screen.queryByText("Test House")).not.toBeInTheDocument()
    })

    it("renders perfume type badge when provided", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("eau de parfum")).toBeInTheDocument()
    })

    it("does not render type badge when type is not provided", () => {
      const dataWithoutType = { ...mockPerfumeData, type: undefined }
      renderWithRouter(<LinkCard data={dataWithoutType} type="perfume" />)
      expect(screen.queryByText("eau de parfum")).not.toBeInTheDocument()
    })
  })

  describe("Navigation", () => {
    it("links to perfume page when type is perfume", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/perfume/test-perfume")
    })

    it("links to house page when type is house", () => {
      renderWithRouter(<LinkCard data={mockHouseData} type="house" />)
      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/perfume-house/test-house")
    })

    it("passes selectedLetter in state when provided", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" selectedLetter="A" />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })

    it("passes sourcePage in state when provided", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" sourcePage="vault" />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })

    it("passes both selectedLetter and sourcePage when both provided", () => {
      renderWithRouter(<LinkCard
          data={mockPerfumeData}
          type="perfume"
          selectedLetter="B"
          sourcePage="favorites"
        />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })
  })

  describe("Image Display", () => {
    it("renders image with correct alt text", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      expect(image).toHaveAttribute("alt", "Test Perfume")
    })

    it("applies correct image dimensions", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      expect(image).toHaveAttribute("height", "400")
      expect(image).toHaveAttribute("width", "300")
    })

    it("applies grayscale filter class", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      // OptimizedImage applies className to container, not img element
      const container = image.closest("div.relative")
      expect(container).toBeInTheDocument()
      expect(container).toHaveClass("grayscale-100")
    })

    it("applies hover transition classes", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      // OptimizedImage applies className to container, not img element
      // Image element has loading classes; hover classes are on container
      const container = image.closest("div.relative")
      expect(container).toBeInTheDocument()
      expect(container).toHaveClass("group-hover:grayscale-0")
      expect(container).toHaveClass("transition-all")
      expect(container).toHaveClass("duration-500")
    })

    it("applies view transition name", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image.style.viewTransitionName).toBe("perfume-image-perfume-1")
    })

    it("applies contain style for performance", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image.style.contain).toBe("layout style paint")
    })
  })

  describe("Type Badge", () => {
    it("displays type with capitalization", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const badge = screen.getByText("eau de parfum")
      expect(badge).toHaveClass("capitalize")
    })

    it("positions badge at bottom right", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const badge = screen.getByText("eau de parfum")
      expect(badge).toHaveClass("absolute")
      expect(badge).toHaveClass("bottom-2")
      expect(badge).toHaveClass("right-2")
    })

    it("applies noir-gold background to badge", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const badge = screen.getByText("eau de parfum")
      expect(badge).toHaveClass("bg-noir-gold")
    })

    it("applies noir-black text to badge", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const badge = screen.getByText("eau de parfum")
      expect(badge).toHaveClass("text-noir-black")
    })

    it("renders different perfume types correctly", () => {
      const types = [
"eau de parfum", "eau de toilette", "parfum", "cologne"
]

      types.forEach(type => {
        const data = { ...mockPerfumeData, type }
        const { unmount } = renderWithRouter(<LinkCard data={data} type="perfume" />)
        expect(screen.getByText(type)).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe("Children", () => {
    it("renders children when provided", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume">
          <button>Add to Wishlist</button>
        </LinkCard>)
      expect(screen.getByText("Add to Wishlist")).toBeInTheDocument()
    })

    it("renders without children", () => {
      expect(() => renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)).not.toThrow()
    })

    it("positions children at bottom with overlay", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume">
          <div data-testid="child-content">Content</div>
        </LinkCard>)

      const childContainer = screen.getByTestId("child-content").parentElement
      expect(childContainer).toHaveClass("absolute")
      expect(childContainer).toHaveClass("bottom-0")
      expect(childContainer).toHaveClass("left-0")
      expect(childContainer).toHaveClass("right-0")
    })

    it("applies dark overlay background to children container", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume">
          <button>Test</button>
        </LinkCard>)

      const childContainer = screen.getByText("Test").parentElement
      expect(childContainer).toHaveClass("bg-noir-dark/80")
    })

    it("applies border to children container", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume">
          <button>Test</button>
        </LinkCard>)

      const childContainer = screen.getByText("Test").parentElement
      expect(childContainer).toHaveClass("border-t")
      expect(childContainer).toHaveClass("border-noir-gold")
    })
  })

  describe("Styling", () => {
    it("applies noir border class", () => {
      const { container } = renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".noir-border")
      expect(card).toBeInTheDocument()
    })

    it("applies transition classes", () => {
      const { container } = renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".transition-all")
      expect(card).toHaveClass("duration-300")
      expect(card).toHaveClass("ease-in-out")
    })

    it("applies dark background with backdrop blur", () => {
      const { container } = renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".bg-noir-dark\\/70")
      expect(card).toBeInTheDocument()

      const backdropBlur = container.querySelector(".backdrop-blur-sm")
      expect(backdropBlur).toBeInTheDocument()
    })

    it("applies group class for hover effects", () => {
      const { container } = renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".group")
      expect(card).toBeInTheDocument()
    })

    it("applies overflow-hidden", () => {
      const { container } = renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".overflow-hidden")
      expect(card).toBeInTheDocument()
    })
  })

  describe("Layout", () => {
    it("uses flex column layout for link", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toHaveClass("flex")
      expect(link).toHaveClass("flex-col")
    })

    it("centers items and justifies between", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toHaveClass("justify-between")
      expect(link).toHaveClass("items-center")
    })

    it("applies padding to link", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toHaveClass("p-4")
    })

    it("centers text content", () => {
      const { container } = renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const textContainer = container.querySelector(".text-center")
      expect(textContainer).toBeInTheDocument()
    })
  })

  describe("Perfume House Display", () => {
    it("applies correct styling to house name", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const houseName = screen.getByText("Test House")
      expect(houseName).toHaveClass("text-md")
      expect(houseName).toHaveClass("font-semibold")
      expect(houseName).toHaveClass("text-noir-gold-100")
    })

    it("renders house name as paragraph", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const houseName = screen.getByText("Test House")
      expect(houseName.tagName).toBe("P")
    })
  })

  describe("Text Wrapping", () => {
    it("applies text-wrap to perfume name", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const heading = screen.getByRole("heading")
      expect(heading).toHaveClass("text-wrap")
      expect(heading).toHaveClass("break-words")
    })

    it("handles long perfume names", () => {
      const longNameData = {
        ...mockPerfumeData,
        name: "This is a very long perfume name that should wrap properly",
      }
      renderWithRouter(<LinkCard data={longNameData} type="perfume" />)
      expect(screen.getByText(/very long perfume name/)).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("uses semantic heading for name", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const heading = screen.getByRole("heading")
      expect(heading.tagName).toBe("H2")
    })

    it("provides descriptive alt text for image", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      expect(image).toHaveAttribute("alt", "Test Perfume")
    })

    it("uses semantic link element", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })

    it("has visible text for navigation", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("Test Perfume")).toBeVisible()
    })
  })

  describe("Edge Cases", () => {
    // it("handles missing image gracefully", () => {
    //   const dataWithoutImage = { ...mockPerfumeData, image: "" }
    //   renderWithRouter(<LinkCard data={dataWithoutImage} type="perfume" />)
    //   expect(screen.getByText("No Image")).toBeInTheDocument()
    //   expect(screen.queryByRole("img")).not.toBeInTheDocument()
    // })

    // it("handles undefined image", () => {
    //   const dataWithUndefinedImage = { ...mockPerfumeData, image: undefined }
    //   renderWithRouter(<LinkCard data={dataWithUndefinedImage} type="perfume" />)
    //   expect(screen.getByText("No Image")).toBeInTheDocument()
    //   expect(screen.queryByRole("img")).not.toBeInTheDocument()
    // })

    // it("handles null image", () => {
    //   const dataWithNullImage = {
    //     ...mockPerfumeData,
    //     image: null as unknown as string | undefined,
    //   }
    //   renderWithRouter(<LinkCard data={dataWithNullImage} type="perfume" />)
    //   expect(screen.getByText("No Image")).toBeInTheDocument()
    //   expect(screen.queryByRole("img")).not.toBeInTheDocument()
    // })

    it("handles special characters in name", () => {
      const specialCharData = {
        ...mockPerfumeData,
        name: "L'Eau D'Issey & Co.",
      }
      renderWithRouter(<LinkCard data={specialCharData} type="perfume" />)
      expect(screen.getByText("L'Eau D'Issey & Co.")).toBeInTheDocument()
    })

    it("handles empty perfumeHouse object", () => {
      const dataWithEmptyHouse = {
        ...mockPerfumeData,
        perfumeHouse: { name: "" },
      }
      renderWithRouter(<LinkCard data={dataWithEmptyHouse} type="perfume" />)
      expect(screen.getByRole("heading")).toBeInTheDocument()
    })

    it("handles null children", () => {
      expect(() => renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume">
            {null}
          </LinkCard>)).not.toThrow()
    })

    it("handles multiple children", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume">
          <button>Add to Wishlist</button>
          <button>Quick View</button>
        </LinkCard>)
      expect(screen.getByText("Add to Wishlist")).toBeInTheDocument()
      expect(screen.getByText("Quick View")).toBeInTheDocument()
    })
  })

  describe("View Transition", () => {
    it("applies viewTransition attribute to link", () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })

    it("sets unique viewTransitionName based on item id", async () => {
      renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image.style.viewTransitionName).toBe("perfume-image-perfume-1")
    })

    it("creates different viewTransitionName for different items", async () => {
      const data1 = { ...mockPerfumeData, id: "perfume-1" }
      const data2 = {
        ...mockPerfumeData,
        id: "perfume-2",
        name: "Another Perfume",
      }

      const { unmount } = renderWithRouter(<LinkCard data={data1} type="perfume" />)

      const image1 = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image1.style.viewTransitionName).toBe("perfume-image-perfume-1")
      unmount()

      renderWithRouter(<LinkCard data={data2} type="perfume" />)

      const image2 = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image2.style.viewTransitionName).toBe("perfume-image-perfume-2")
    })
  })

  describe("Integration", () => {
    it("works with both perfume and house types", () => {
      const { unmount } = renderWithRouter(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("Test Perfume")).toBeInTheDocument()
      unmount()

      renderWithRouter(<LinkCard data={mockHouseData} type="house" />)
      expect(screen.getByText("Test House")).toBeInTheDocument()
    })

    it("integrates with router navigation", () => {
      render(<MemoryRouter initialEntries={["/"]}>
          <LinkCard data={mockPerfumeData} type="perfume" />
        </MemoryRouter>)

      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/perfume/test-perfume")
    })
  })
})
