import { describe, expect, it } from "vitest"

import { extractUnlabeledFragranceNotesBlock, isThemeCssTokenNote } from "@/lib/scraper/note-source-confirmation"
import { resolveProductName } from "@/lib/scraper/stages/pdp-bootstrap"
import {
  cleanTitle,
  extractNotesFromStructuredText,
} from "@/lib/scraper/stages/title-cleaning"

describe("Mochiglow scrape repairs", () => {
  it("rebuilds the product name from the URL when reviews chrome wins the title", () => {
    expect(
      resolveProductName({
        name: "Customer Reviews Based On Reviews Write A Review % % % % % A Amanda Never Knew I Wanted To Smell Like Fruity Cereal Until I Got This Perfume",
        detailURL: "https://www.mochiglow.com/products/perfume-cereal-milk",
      }),
    ).toBe("Perfume Cereal Milk")
  })

  it("strips catalog Perfume prefix/suffix from titles", () => {
    expect(cleanTitle("Perfume - Pandan Coconut", { titleDashSegment: "none" })).toBe(
      "Pandan Coconut",
    )
    expect(cleanTitle("Cereal Milk Perfume", { titleDashSegment: "none" })).toBe("Cereal Milk")
    expect(cleanTitle("Perfume Cereal Milk", { titleDashSegment: "none" })).toBe("Cereal Milk")
  })

  it("parses pipe-separated Fragrance Notes and stops before How To Use", () => {
    const source = `Pandan is a leafy green plant native to South & Southeast Asia. Known as "vanilla of the east."
Fragrance Notes
pandan leaf | creamy coconut milk | sweet lemongrass
Scent Strength
How To Use
Apply to pulse points.`
    expect(extractUnlabeledFragranceNotesBlock(source)).toEqual([
      "pandan leaf",
      "creamy coconut milk",
      "sweet lemongrass",
    ])
  })

  it("parses unlabeled top / middle / base note blocks", () => {
    const source = `Ice cold milk splashes into a glass bowl.
top notes
marshmallow, frosted sugar
middle notes
fruity cereal, puffed rice
base notes
creamy milk, sweet vanilla
Scent Strength`
    const notes = extractNotesFromStructuredText(source, 2)
    expect(notes.openNotes).toEqual(expect.arrayContaining(["marshmallow", "frosted sugar"]))
    expect(notes.heartNotes).toEqual(expect.arrayContaining(["fruity cereal", "puffed rice"]))
    expect(notes.baseNotes).toEqual(expect.arrayContaining(["creamy milk", "sweet vanilla"]))
  })

  it("rejects Shopify class tokens that leaked as notes on leftover PDPs", () => {
    expect(isThemeCssTokenNote("no-js")).toBe(true)
    expect(isThemeCssTokenNote("article")).toBe(true)
    expect(isThemeCssTokenNote("pagetransition")).toBe(true)
  })
})
