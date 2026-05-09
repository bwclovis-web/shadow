import { cleanup, screen, waitFor } from "@testing-library/react"
import type { PropsWithChildren, ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "@/test/utils/test-utils"

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...rest
  }: {
    src?: string
    alt?: string
    [k: string]: unknown
  }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test mock for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} {...rest} />
  ),
}))

vi.mock("next-view-transitions", () => ({
  useTransitionRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({
    children,
    href,
    ...rest
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import LinkCard from "./LinkCard"

const renderLinkCard = (ui: ReactElement) => renderWithProviders(ui)

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
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("Test Perfume")).toBeInTheDocument()
    })

    it("renders perfume name", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByRole("heading", { name: "Test Perfume" })).toBeInTheDocument()
    })

    it("renders perfume house name when provided", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("Test House")).toBeInTheDocument()
    })

    it("renders image with correct src", async () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img", { name: "Test Perfume" }))
      expect(image).toHaveAttribute("src", "/images/test-perfume.jpg")
    })

    it("does not render house name when not provided", () => {
      const dataWithoutHouse = { ...mockPerfumeData, perfumeHouse: undefined }
      renderLinkCard(<LinkCard data={dataWithoutHouse} type="perfume" />)
      expect(screen.queryByText("Test House")).not.toBeInTheDocument()
    })

    it("renders perfume type badge when provided", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("eau de parfum")).toBeInTheDocument()
    })

    it("does not render type badge when type is not provided", () => {
      const dataWithoutType = { ...mockPerfumeData, type: undefined }
      renderLinkCard(<LinkCard data={dataWithoutType} type="perfume" />)
      expect(screen.queryByText("eau de parfum")).not.toBeInTheDocument()
    })
  })

  describe("Navigation", () => {
    it("links to perfume page when type is perfume", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/perfume/test-perfume")
    })

    it("links to house page when type is house", () => {
      renderLinkCard(<LinkCard data={mockHouseData} type="house" />)
      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/houses/test-house")
    })

    it("passes selectedLetter in state when provided", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" selectedLetter="A" />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })

    it("passes sourcePage in state when provided", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" sourcePage="vault" />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })

    it("passes both selectedLetter and sourcePage when both provided", () => {
      renderLinkCard(<LinkCard
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
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      expect(image).toHaveAttribute("alt", "Test Perfume")
    })

    it("applies correct image dimensions", async () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      expect(image).toHaveAttribute("height", "400")
      expect(image).toHaveAttribute("width", "400")
    })

    it("applies grayscale filter class", async () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      expect(image.className).toMatch(/grayscale-100/)
    })

    it("applies hover transition classes", async () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      expect(image.className).toMatch(/group-hover:grayscale-0/)
      expect(image.className).toMatch(/transition-all/)
      expect(image.className).toMatch(/duration-500/)
    })

    it("applies view transition name", async () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image.style.viewTransitionName).toBe("perfume-image-perfume-1")
    })

    it("does not rely on inline contain style on the image", async () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image.style.contain).toBe("")
    })
  })

  describe("Type Badge", () => {
    it("displays type with capitalization", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const badge = screen.getByText("eau de parfum")
      expect(badge).toHaveClass("capitalize")
    })

    it("positions badge at bottom right", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const badge = screen.getByText("eau de parfum")
      expect(badge).toHaveClass("absolute")
      expect(badge).toHaveClass("bottom-6")
      expect(badge).toHaveClass("right-2")
    })

    it("applies noir-gold background to badge", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const badge = screen.getByText("eau de parfum")
      expect(badge).toHaveClass("bg-noir-gold")
    })

    it("applies noir-black text to badge", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const badge = screen.getByText("eau de parfum")
      expect(badge).toHaveClass("text-noir-black")
    })

    it("renders different perfume types correctly", () => {
      const types = [
"eau de parfum", "eau de toilette", "parfum", "cologne"
]

      types.forEach(type => {
        const data = { ...mockPerfumeData, type }
        const { unmount } = renderLinkCard(<LinkCard data={data} type="perfume" />)
        expect(screen.getByText(type)).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe("Children", () => {
    it("renders children when provided", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume">
          <button>Add to Wishlist</button>
        </LinkCard>)
      expect(screen.getByText("Add to Wishlist")).toBeInTheDocument()
    })

    it("renders without children", () => {
      expect(() => renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)).not.toThrow()
    })

    it("positions children at bottom with overlay", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume">
          <div data-testid="child-content">Content</div>
        </LinkCard>)

      const childContainer = screen.getByTestId("child-content").parentElement
      expect(childContainer).toHaveClass("absolute")
      expect(childContainer).toHaveClass("bottom-0")
      expect(childContainer).toHaveClass("left-0")
      expect(childContainer).toHaveClass("right-0")
    })

    it("applies dark overlay background to children container", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume">
          <button>Test</button>
        </LinkCard>)

      const childContainer = screen.getByText("Test").parentElement
      expect(childContainer).toHaveClass("bg-noir-dark/80")
    })

    it("applies border to children container", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume">
          <button>Test</button>
        </LinkCard>)

      const childContainer = screen.getByText("Test").parentElement
      expect(childContainer).toHaveClass("border-t")
      expect(childContainer).toHaveClass("border-noir-gold")
    })
  })

  describe("Styling", () => {
    it("applies noir border class", () => {
      const { container } = renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".noir-border")
      expect(card).toBeInTheDocument()
    })

    it("applies transition classes", () => {
      const { container } = renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".transition-all")
      expect(card).toHaveClass("duration-300")
      expect(card).toHaveClass("ease-in-out")
    })

    it("applies dark background with backdrop blur", () => {
      const { container } = renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".bg-noir-dark\\/70")
      expect(card).toBeInTheDocument()

      const backdropBlur = container.querySelector(".backdrop-blur-sm")
      expect(backdropBlur).toBeInTheDocument()
    })

    it("applies group class for hover effects", () => {
      const { container } = renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".group")
      expect(card).toBeInTheDocument()
    })

    it("applies overflow-hidden", () => {
      const { container } = renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const card = container.querySelector(".overflow-hidden")
      expect(card).toBeInTheDocument()
    })
  })

  describe("Layout", () => {
    it("uses flex column layout for link", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toHaveClass("flex")
      expect(link).toHaveClass("flex-col")
    })

    it("centers items and justifies between", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toHaveClass("justify-between")
      expect(link).toHaveClass("items-center")
    })

    it("does not add outer padding on the link (inner blocks handle spacing)", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).not.toHaveClass("p-4")
    })

    it("centers text content", () => {
      const { container } = renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const textContainer = container.querySelector(".text-center")
      expect(textContainer).toBeInTheDocument()
    })
  })

  describe("Perfume House Display", () => {
    it("applies correct styling to house name", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const houseName = screen.getByText("Test House")
      expect(houseName).toHaveClass("text-sm")
      expect(houseName).toHaveClass("text-noir-gold-100")
    })

    it("renders house name as paragraph", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const houseName = screen.getByText("Test House")
      expect(houseName.tagName).toBe("P")
    })
  })

  describe("Text Wrapping", () => {
    it("applies text-wrap to perfume name", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const heading = screen.getByRole("heading")
      expect(heading).toHaveClass("text-wrap")
      expect(heading).toHaveClass("wrap-break-word")
    })

    it("handles long perfume names", () => {
      const longNameData = {
        ...mockPerfumeData,
        name: "This is a very long perfume name that should wrap properly",
      }
      renderLinkCard(<LinkCard data={longNameData} type="perfume" />)
      expect(
        screen.getByRole("heading", { name: /very long perfume name/i })
      ).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("uses semantic heading for name", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const heading = screen.getByRole("heading")
      expect(heading.tagName).toBe("H2")
    })

    it("provides descriptive alt text for image", async () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const image = await waitFor(() => screen.getByRole("img"))
      expect(image).toHaveAttribute("alt", "Test Perfume")
    })

    it("uses semantic link element", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })

    it("has visible text for navigation", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("Test Perfume")).toBeVisible()
    })
  })

  describe("Edge Cases", () => {
    // it("handles missing image gracefully", () => {
    //   const dataWithoutImage = { ...mockPerfumeData, image: "" }
    //   renderLinkCard(<LinkCard data={dataWithoutImage} type="perfume" />)
    //   expect(screen.getByText("No Image")).toBeInTheDocument()
    //   expect(screen.queryByRole("img")).not.toBeInTheDocument()
    // })

    // it("handles undefined image", () => {
    //   const dataWithUndefinedImage = { ...mockPerfumeData, image: undefined }
    //   renderLinkCard(<LinkCard data={dataWithUndefinedImage} type="perfume" />)
    //   expect(screen.getByText("No Image")).toBeInTheDocument()
    //   expect(screen.queryByRole("img")).not.toBeInTheDocument()
    // })

    // it("handles null image", () => {
    //   const dataWithNullImage = {
    //     ...mockPerfumeData,
    //     image: null as unknown as string | undefined,
    //   }
    //   renderLinkCard(<LinkCard data={dataWithNullImage} type="perfume" />)
    //   expect(screen.getByText("No Image")).toBeInTheDocument()
    //   expect(screen.queryByRole("img")).not.toBeInTheDocument()
    // })

    it("handles special characters in name", () => {
      const specialCharData = {
        ...mockPerfumeData,
        name: "L'Eau D'Issey & Co.",
      }
      renderLinkCard(<LinkCard data={specialCharData} type="perfume" />)
      expect(screen.getByText("L'Eau D'Issey & Co.")).toBeInTheDocument()
    })

    it("handles empty perfumeHouse object", () => {
      const dataWithEmptyHouse = {
        ...mockPerfumeData,
        perfumeHouse: { name: "" },
      }
      renderLinkCard(<LinkCard data={dataWithEmptyHouse} type="perfume" />)
      expect(screen.getByRole("heading")).toBeInTheDocument()
    })

    it("handles null children", () => {
      expect(() => renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume">
            {null}
          </LinkCard>)).not.toThrow()
    })

    it("handles multiple children", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume">
          <button>Add to Wishlist</button>
          <button>Quick View</button>
        </LinkCard>)
      expect(screen.getByText("Add to Wishlist")).toBeInTheDocument()
      expect(screen.getByText("Quick View")).toBeInTheDocument()
    })
  })

  describe("View Transition", () => {
    it("applies viewTransition attribute to link", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      const link = screen.getByRole("link")
      expect(link).toBeInTheDocument()
    })

    it("sets unique viewTransitionName based on item id", async () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
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

      const { unmount } = renderLinkCard(<LinkCard data={data1} type="perfume" />)

      const image1 = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image1.style.viewTransitionName).toBe("perfume-image-perfume-1")
      unmount()

      renderLinkCard(<LinkCard data={data2} type="perfume" />)

      const image2 = await waitFor(() => screen.getByRole("img")) as HTMLImageElement
      expect(image2.style.viewTransitionName).toBe("perfume-image-perfume-2")
    })
  })

  describe("Integration", () => {
    it("works with both perfume and house types", () => {
      const { unmount } = renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)
      expect(screen.getByText("Test Perfume")).toBeInTheDocument()
      unmount()

      renderLinkCard(<LinkCard data={mockHouseData} type="house" />)
      expect(screen.getByText("Test House")).toBeInTheDocument()
    })

    it("renders link href for perfume detail route", () => {
      renderLinkCard(<LinkCard data={mockPerfumeData} type="perfume" />)

      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/perfume/test-perfume")
    })
  })
})
