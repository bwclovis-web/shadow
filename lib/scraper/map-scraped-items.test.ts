import { describe, expect, it } from "vitest"

import {
  pythonMerchantNotesComplete,
  scrapedItemsNeedArtisticFragrancesRepair,
  scrapedItemsNeedNodeRepair,
} from "./map-scraped-items"
import type { ScrapedItem } from "@/types/scraper"

const solidPyramid = (overrides: Partial<ScrapedItem> = {}): ScrapedItem => ({
  name: "Naviglio",
  description: "Merchant copy with materials.",
  image: "",
  detailURL: "https://example.com/products/naviglio",
  perfumeHouse: "Test House",
  openNotes: ["bergamot", "neroli", "lemon"],
  heartNotes: ["jasmine", "rose", "lavender"],
  baseNotes: ["musk", "cedar", "amber"],
  _noteSource: "text_regex_layered",
  ...overrides,
})

describe("pythonMerchantNotesComplete", () => {
  it("returns true for a clean merchant pyramid", () => {
    expect(pythonMerchantNotesComplete([solidPyramid()])).toBe(true)
  })

  it("returns false when open layer is empty", () => {
    expect(
      pythonMerchantNotesComplete([
        solidPyramid({ openNotes: [], heartNotes: ["a", "b", "c"], baseNotes: ["d", "e", "f"] }),
      ]),
    ).toBe(false)
  })

  it("returns false when notes look like prose junk", () => {
    expect(
      pythonMerchantNotesComplete([
        solidPyramid({
          openNotes: ["notes swirl", "she replies", "like a faceted"],
          heartNotes: ["to the imagination", "or what", "rgba"],
          baseNotes: ["linear-gradient", "footer", "navigation"],
        }),
      ]),
    ).toBe(false)
  })

  it("returns false for Artistic Milano with empty open even if other layers are full", () => {
    expect(
      pythonMerchantNotesComplete([
        solidPyramid({
          detailURL: "https://artisticfragrances.com/milano-fragranze/naviglio/",
          openNotes: [],
          heartNotes: ["lavandin", "petitgrain", "vetiver"],
          baseNotes: ["cedarwood", "white musk", "aquatic"],
        }),
      ]),
    ).toBe(false)
  })

  it("returns false when URL does not align with product name", () => {
    expect(
      pythonMerchantNotesComplete([
        solidPyramid({
          name: "Naviglio",
          detailURL: "https://example.com/products/completely-different-slug",
        }),
      ]),
    ).toBe(false)
  })

  it("returns false for non-merchant note source", () => {
    expect(pythonMerchantNotesComplete([solidPyramid({ _noteSource: "llm_description" })])).toBe(
      false,
    )
  })
})

describe("scrapedItemsNeedArtisticFragrancesRepair", () => {
  it("flags empty open on Milano PDP", () => {
    expect(
      scrapedItemsNeedArtisticFragrancesRepair([
        solidPyramid({
          detailURL: "https://artisticfragrances.com/milano-fragranze/naviglio/",
          openNotes: [],
          _noteSource: "llm_description",
        }),
      ]),
    ).toBe(true)
  })

  it("does not flag complete merchant Milano pyramid", () => {
    expect(
      scrapedItemsNeedArtisticFragrancesRepair([
        solidPyramid({
          detailURL: "https://artisticfragrances.com/milano-fragranze/naviglio/",
        }),
      ]),
    ).toBe(false)
  })
})

describe("scrapedItemsNeedNodeRepair", () => {
  it("flags theme CSS token notes", () => {
    expect(
      scrapedItemsNeedNodeRepair([
        solidPyramid({
          openNotes: ["--tw-shadow", "bergamot", "lemon"],
        }),
      ]),
    ).toBe(true)
  })

  it("flags empty layers when labeled notesText is present", () => {
    expect(
      scrapedItemsNeedNodeRepair([
        {
          name: "Agape",
          openNotes: [],
          heartNotes: [],
          baseNotes: [],
          notesText:
            "Notes: Palo santo, blood orange, soft white florals, peach, copaiba balsam, cedar moss, vetiver, sandalwood",
          detailURL: "https://damaskhaus.com/products/agape",
        },
      ]),
    ).toBe(true)
  })

  it("flags empty layers so Node can recover notes from description", () => {
    expect(
      scrapedItemsNeedNodeRepair([
        {
          name: "Empty",
          description:
            "A short but complete product story about this scent on skin after a morning walk.",
          openNotes: [],
          heartNotes: [],
          baseNotes: [],
          detailURL: "https://example.com/products/empty-perfume",
        },
      ]),
    ).toBe(true)
  })
})
