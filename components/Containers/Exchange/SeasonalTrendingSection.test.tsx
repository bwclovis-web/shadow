/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { SeasonalTrendingPerfumeRow } from "@/models/seasonal-trending.server"

import SeasonalTrendingSection from "./SeasonalTrendingSection"

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

const perfumes: SeasonalTrendingPerfumeRow[] = [
  {
    perfumeId: "p-1",
    voteCount: 7,
    name: "Lost Cherry",
    slug: "lost-cherry",
    image: "https://example.com/lost-cherry.jpg",
    perfumeHouse: { id: "h-1", name: "Tom Ford", slug: "tom-ford" },
  },
  {
    perfumeId: "p-2",
    voteCount: 3,
    name: "Unknown House Scent",
    slug: "unknown-house-scent",
    image: null,
    perfumeHouse: null,
  },
]

describe("SeasonalTrendingSection", () => {
  it("renders the homepage strip as a ranked list of perfume links without vote counts", () => {
    render(<SeasonalTrendingSection season="spring" perfumes={perfumes} variant="compact" />)

    expect(
      screen.getByRole("heading", { level: 2, name: /home\.seasonalTrending\.title/ })
    ).toBeTruthy()
    const items = within(screen.getByRole("list")).getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toContain("1")
    expect(items[0]?.textContent).toContain("Lost Cherry")
    expect(items[0]?.textContent).toContain("Tom Ford")
    expect(items[1]?.textContent).toContain("2")
    expect(within(items[0]!).getByRole("link").getAttribute("href")).toBe("/perfume/lost-cherry")
    expect(screen.queryByText(/voteCount/)).toBeNull()
  })

  it("keeps vote counts and the description in the Exchange sidebar", () => {
    render(<SeasonalTrendingSection season="spring" perfumes={perfumes} variant="sidebar" />)

    expect(screen.getByText("tradingPost.seasonalTrending.description")).toBeTruthy()
    expect(screen.getAllByText(/tradingPost\.seasonalTrending\.voteCount/)).toHaveLength(2)
  })

  it("renders nothing without results", () => {
    const { container } = render(
      <SeasonalTrendingSection season="spring" perfumes={[]} variant="compact" />
    )

    expect(container.firstChild).toBeNull()
  })
})
