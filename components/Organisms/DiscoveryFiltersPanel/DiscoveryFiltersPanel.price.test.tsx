import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

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

vi.mock("@/components/Organisms/TagSearch/TagSearch", () => ({
  default: () => <div data-testid="tag-search-stub" />,
}))

vi.mock("@/components/Molecules/HouseAutocomplete", () => ({
  HouseAutocomplete: () => <div data-testid="house-autocomplete-stub" />,
}))

vi.mock(
  "@/components/Containers/Perfume/PerfumeSeasonVote/SeasonSelectionToggleRow",
  () => ({
    SeasonSelectionToggleRow: () => <div data-testid="season-row-stub" />,
  })
)

import {
  emptyDiscoveryFilters,
  type PerfumeDiscoveryFilters,
} from "@/utils/discovery-filters"

import {
  DiscoveryFiltersPanel,
  type DiscoveryFiltersPanelLabels,
} from "./DiscoveryFiltersPanel"

const labels: DiscoveryFiltersPanelLabels = {
  notesTitle: "Notes",
  notesDescription: "",
  notesSearchLabel: "Notes search",
  seasonTitle: "Season",
  seasonDescription: "",
  houseTitle: "House",
  houseSearchLabel: "House search",
  houseClear: "Clear house",
  priceTitle: "Price",
  priceDescription: "",
  minLabel: "Min",
  maxLabel: "Max",
  tradePrefTitle: "Trade",
  tradePrefDescription: "",
  tradePrefAria: "Trade preference",
  tradePrefCash: "Cash",
  tradePrefTrade: "Trade",
  tradePrefBoth: "Both",
  bottleTitle: "Bottle",
  bottleDescription: "",
  bottleAria: "Bottle type",
  bottleFull: "Full",
  bottlePartial: "Partial",
  bottleSample: "Sample",
  bottleDecant: "Decant",
  conditionTitle: "Condition",
  conditionDescription: "",
  conditionAria: "Condition",
  conditionLabels: {
    sealed: "Sealed",
    mint: "Mint",
    lightlyUsed: "Lightly used",
    heavilyUsed: "Heavily used",
    damaged: "Damaged",
  },
  regionTitle: "Region",
  regionDescription: "",
  regionLabel: "Region",
  regionAll: "Any region",
  regionUS: "US",
  regionUK: "UK",
  regionAU: "AU",
  regionEU: "EU",
  regionOther: "Other",
  hasPhotosLabel: "Photos",
  hasPhotosDescription: "",
  hasPhotosToggle: "Has photos",
  minRepTitle: "Reputation",
  minRepDescription: "",
  minRepLabel: "Min reputation",
  minRepAll: "Any",
}

afterEach(() => {
  cleanup()
})

describe("DiscoveryFiltersPanel price flush", () => {
  it("exposes typed price via registerPendingPriceFlush without blur", () => {
    let flush: (() => PerfumeDiscoveryFilters) | null = null
    const onChange = vi.fn()

    render(
      <DiscoveryFiltersPanel
        value={emptyDiscoveryFilters()}
        onChange={onChange}
        initialNoteTags={[]}
        initialHouse={null}
        labels={labels}
        layout="drawer"
        registerPendingPriceFlush={fn => {
          flush = fn
        }}
      />
    )

    const min = screen.getByLabelText("Min")
    fireEvent.change(min, { target: { value: "42" } })
    // Do not blur — Apply path must still see the typed value.
    expect(flush).toBeTruthy()
    expect(flush!()).toMatchObject({ minPrice: 42, maxPrice: null })
  })

  it("normalizes reversed range in the flush result", () => {
    let flush: (() => PerfumeDiscoveryFilters) | null = null

    render(
      <DiscoveryFiltersPanel
        value={emptyDiscoveryFilters()}
        onChange={vi.fn()}
        initialNoteTags={[]}
        initialHouse={null}
        labels={labels}
        layout="drawer"
        registerPendingPriceFlush={fn => {
          flush = fn
        }}
      />
    )

    fireEvent.change(screen.getByLabelText("Min"), {
      target: { value: "200" },
    })
    fireEvent.change(screen.getByLabelText("Max"), {
      target: { value: "50" },
    })

    expect(flush!()).toMatchObject({ minPrice: 50, maxPrice: 200 })
  })
})
