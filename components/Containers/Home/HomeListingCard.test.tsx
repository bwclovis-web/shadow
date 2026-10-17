/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { HomeListing } from "@/types/home-listing"

import HomeListingCard from "./HomeListingCard"

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Record<string, unknown>) =>
      values ? `${namespace}.${key}:${JSON.stringify(values)}` : `${namespace}.${key}`,
}))

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- lightweight stub for next/image in tests
    <img src={src} alt={alt} />
  ),
}))

vi.mock("@/components/Atoms/PrefetchLink", () => ({
  PrefetchLink: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const baseListing: HomeListing = {
  id: "up-1",
  createdAt: new Date("2026-05-20T12:00:00.000Z"),
  images: ["https://example.com/photo.jpg"],
  availableMl: "10",
  type: "eauDeParfum",
  condition: "lightlyUsed",
  decantFormat: "atomizer",
  tradePreference: "both",
  tradeOnly: false,
  perfume: {
    id: "p-1",
    name: "Lost Cherry",
    slug: "lost-cherry",
    image: "https://example.com/catalog.jpg",
    houseName: "Tom Ford",
  },
  trader: { id: "u-1", displayName: "noirnose", avatarImage: null },
}

describe("HomeListingCard", () => {
  it("shows stored listing facts and links to the perfume and trader", () => {
    const { container } = render(<HomeListingCard listing={baseListing} />)

    expect(screen.getByText("Tom Ford")).toBeTruthy()
    expect(
      screen.getByText(
        'home.galleryWalk.latest.milliliters:{"amount":"10"} · Eau de Parfum · listing.decantFormat.atomizer'
      )
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: "Lost Cherry" }).getAttribute("href")).toBe(
      "/perfume/lost-cherry"
    )
    expect(screen.getByRole("link", { name: /noirnose/ }).getAttribute("href")).toBe(
      "/trader-profile/u-1"
    )
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/photo.jpg"
    )
  })

  it("keeps the compare button outside every link", () => {
    const { container } = render(<HomeListingCard listing={baseListing} />)

    const compare = screen.getByRole("button")
    expect(compare.closest("a")).toBeNull()
    expect(container.querySelectorAll("a button, button a")).toHaveLength(0)
  })

  it("falls back to the catalog image when the listing has no photos", () => {
    const { container } = render(
      <HomeListingCard listing={{ ...baseListing, images: [] }} />
    )

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/catalog.jpg"
    )
  })

  it("omits unknown or invalid optional fields instead of guessing", () => {
    const { container } = render(
      <HomeListingCard
        listing={{
          ...baseListing,
          images: [],
          availableMl: "about half",
          type: null,
          condition: null,
          decantFormat: null,
          perfume: { ...baseListing.perfume, image: null, houseName: null },
        }}
      />
    )

    expect(container.querySelector("img")).toBeNull()
    expect(screen.queryByText(/milliliters/)).toBeNull()
    expect(screen.queryByText(/Eau de/)).toBeNull()
    expect(screen.queryByText(/decantFormat/)).toBeNull()
    expect(screen.queryByText(/listing\.condition/)).toBeNull()
    expect(screen.queryByText("Tom Ford")).toBeNull()
  })
})
