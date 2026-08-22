import { describe, expect, it } from "vitest"

import {
  extractMerchantNoteBootstrapFromHtml,
  __testOnly,
} from "@/lib/scraper/stages/pdp-bootstrap"
import { extractNotesFromStructuredText } from "@/lib/scraper/notes-graph"
import {
  isObviousNonMaterialNote,
  looksLikeProseNotePhrase,
} from "@/lib/scraper/note-source-confirmation"

const { extractKayaliNotesContainerFromHtml, extractLayeredHeadingPyramidFromPlain } =
  __testOnly

describe("Kayali notes-container bootstrap", () => {
  const kayaliHtml = `
    <div class="product-about__tabs__tab--notes">
      <ul class="notes-container flex f-d-column f-gap-24">
        <li class="flex f-gap-8 f-a-center">
          <p class="text-light">Pistachio Gelato, Hazelnut, Italian Bergamot, Sweet Rum, Cardamom</p>
        </li>
        <li class="flex f-gap-8 f-a-center">
          <p class="text-light">White Peach, Muguet, Jasmine, Raspberry, White Peony, Green Pear, Geranium</p>
        </li>
        <li class="flex f-gap-8 f-a-center">
          <p class="text-light">Whipped Cream, Marshmallow, Cotton Candy, Turkish Delight, Cocoa, Cedarwood, Sandalwood, Tonka</p>
        </li>
      </ul>
    </div>
  `

  const kayaliLabeledHtml = `
    <ul class="notes-container flex f-d-column">
      <li class="flex f-d-column">
        <div><h5 class="h5">Top Notes:</h5></div>
        <ul class="flex">
          <div class="product-tag"><span class="font-body-xs">Matcha</span></div>
          <div class="product-tag"><span class="font-body-xs">Bergamot</span></div>
          <div class="product-tag"><span class="font-body-xs">Mate</span></div>
          <div class="product-tag"><span class="font-body-xs">Green Apple</span></div>
        </ul>
      </li>
      <li class="flex f-d-column">
        <div><h5 class="h5">Middle Notes:</h5></div>
        <ul class="flex">
          <div class="product-tag"><span class="font-body-xs">Oat Milk</span></div>
          <div class="product-tag"><span class="font-body-xs">Praline</span></div>
          <div class="product-tag"><span class="font-body-xs">Coffee</span></div>
          <div class="product-tag"><span class="font-body-xs">Vanilla</span></div>
        </ul>
      </li>
      <li class="flex f-d-column">
        <div><h5 class="h5">Dry Notes:</h5></div>
        <ul class="flex">
          <div class="product-tag"><span class="font-body-xs">Sandalwood</span></div>
          <div class="product-tag"><span class="font-body-xs">Sweet Musk</span></div>
          <div class="product-tag"><span class="font-body-xs">Amber</span></div>
        </ul>
      </li>
    </ul>
    <meta name="description" content="opens with bright notes of lemon to complement sugar, giving way to freesia and raspberry that sits a" />
  `

  it("extractKayaliNotesContainerFromHtml maps three unlabeled lists to Top/Heart/Base", () => {
    const bootstrap = extractKayaliNotesContainerFromHtml(kayaliHtml)
    expect(bootstrap).toContain("top notes: Pistachio Gelato, Hazelnut")
    expect(bootstrap).toContain("heart notes: White Peach, Muguet")
    expect(bootstrap).toContain("base notes: Whipped Cream, Marshmallow")
  })

  it("extractKayaliNotesContainerFromHtml maps labeled Top/Middle/Dry product-tag chips", () => {
    const bootstrap = extractKayaliNotesContainerFromHtml(kayaliLabeledHtml)
    expect(bootstrap).toContain("top notes: Matcha, Bergamot, Mate, Green Apple")
    expect(bootstrap).toContain("heart notes: Oat Milk, Praline, Coffee, Vanilla")
    expect(bootstrap).toContain("base notes: Sandalwood, Sweet Musk, Amber")
  })

  it("extractMerchantNoteBootstrapFromHtml prefers Kayali notes-container over truncated meta", () => {
    const bootstrap = extractMerchantNoteBootstrapFromHtml(kayaliLabeledHtml)
    expect(bootstrap).toMatch(/top notes:\s*Matcha/i)
    expect(bootstrap).not.toMatch(/raspberry that sits/i)
  })

  it("structured parse yields real materials (not empty / var)", () => {
    const bootstrap = extractKayaliNotesContainerFromHtml(kayaliHtml)!
    const notes = extractNotesFromStructuredText(bootstrap, 2)
    expect(notes.openNotes.map(n => n.toLowerCase())).toEqual(
      expect.arrayContaining(["pistachio gelato", "hazelnut", "cardamom"]),
    )
    expect(notes.heartNotes.map(n => n.toLowerCase())).toEqual(
      expect.arrayContaining(["muguet", "jasmine", "raspberry"]),
    )
    expect(notes.baseNotes.map(n => n.toLowerCase())).toEqual(
      expect.arrayContaining(["marshmallow", "tonka", "sandalwood"]),
    )
    expect(notes.baseNotes.map(n => n.toLowerCase())).not.toContain("var")
  })

  it("maps single-note heart layer without shifting base up (Musk-12)", () => {
    const musk12Html = `
      <ul class="notes-container">
        <li><p>Lotus Flower, Jasmine, Freesia</p></li>
        <li><p>Musk</p></li>
        <li><p>Vanilla, Creamy Sandalwood</p></li>
      </ul>
    `
    const bootstrap = extractKayaliNotesContainerFromHtml(musk12Html)
    expect(bootstrap).toContain("top notes: Lotus Flower, Jasmine, Freesia")
    expect(bootstrap).toContain("heart notes: Musk")
    expect(bootstrap).toContain("base notes: Vanilla, Creamy Sandalwood")
    const notes = extractNotesFromStructuredText(bootstrap!, 2)
    expect(notes.heartNotes.map(n => n.toLowerCase())).toEqual(["musk"])
    expect(notes.baseNotes.map(n => n.toLowerCase())).toEqual(
      expect.arrayContaining(["vanilla", "creamy sandalwood"]),
    )
  })
})

describe("CSS theme bleed must not become base notes", () => {
  it("does not treat --color-base: var(--x) as a pyramid layer", () => {
    const cssBleed =
      ":root { --color-foreground: #111; --color-base: var(--color-foreground); --color-top: red; }"
    expect(extractLayeredHeadingPyramidFromPlain(cssBleed)).toBeNull()
    const notes = extractNotesFromStructuredText(cssBleed, 2)
    expect(notes.openNotes).toEqual([])
    expect(notes.heartNotes).toEqual([])
    expect(notes.baseNotes).toEqual([])
  })

  it("rejects bare var and datalayer as material notes", () => {
    expect(isObviousNonMaterialNote("var")).toBe(true)
    expect(isObviousNonMaterialNote("datalayer")).toBe(true)
    expect(looksLikeProseNotePhrase("raspberry that sits")).toBe(true)
  })
})
