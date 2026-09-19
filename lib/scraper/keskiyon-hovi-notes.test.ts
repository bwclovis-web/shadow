import { describe, expect, it } from "vitest"

import { extractNotesFromStructuredText } from "@/lib/scraper/notes-graph"
import {
  buildNoteConfirmationCorpus,
  extractUnlabeledFragranceNotesBlock,
  isObviousNonMaterialNote,
} from "@/lib/scraper/note-source-confirmation"
import { __testOnly } from "@/lib/scraper/stages/pdp-bootstrap"

const { extractShopifyIndieNoteSegmentsFromPlain, extractLayeredHeadingPyramidFromPlain } =
  __testOnly

const join = (layers: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] }) =>
  [...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes].map(n => n.toLowerCase())

describe("Keskiyön Hovi Shopify note lists", () => {
  it("takes Notes: bullets and ignores Materials of Note chemicals (Kahvila)", () => {
    const source = `
Rain has been falling long enough that no one seems particularly interested in leaving.
Notes: Roasted Coffee • Bittersweet Cocoa • Steamed Oat Milk • Whisper of Cinnamon • White Chocolate Cake • Warm Sugar • Soft Woods • Skin Musk
Ingredients: Alcohol Denat., Parfum (Fragrance), Aqua (Water)
Materials of Note: Cocoa Absolute, Cinnamic Aldehyde, Milk Lactone, Benzyl Salicylate, Cashmeran.
International Orders: fulfilled in an IPM (Isopropyl Myristate) perfume base
`
    const segments = extractShopifyIndieNoteSegmentsFromPlain(source)
    const blob = segments.join("\n")
    expect(blob.toLowerCase()).toMatch(/roasted coffee/)
    expect(blob.toLowerCase()).toMatch(/steamed oat milk/)
    expect(blob.toLowerCase()).not.toMatch(/cinnamic aldehyde/)
    expect(blob.toLowerCase()).not.toMatch(/milk lactone/)
    expect(blob.toLowerCase()).not.toMatch(/isopropyl myristate/)

    const notes = extractNotesFromStructuredText(blob, 2)
    const all = join(notes)
    expect(all).toEqual(
      expect.arrayContaining(["roasted coffee", "bittersweet cocoa", "steamed oat milk", "skin musk"]),
    )
    expect(all.join(" ")).not.toMatch(/cinnamic|lactone|isopropyl/)
  })

  it("stops Notes: before Please Note / Materials of Note (While The Cicadas Sang)", () => {
    const source = `
While The Cicadas Sang is a tribute to those final weeks of summer.
Notes: Lemon Iced Tea • Humid Summer Air • Sun-Warmed Cedar • Golden Honey • Beeswax • Weathered Woods • Sun-Dried Cotton
Please Note: This fragrance contains beeswax absolute and is therefore not vegan.
Materials of Note: Beeswax Absolute (Not Vegan), Lemon Essential Oil, Bergamot Essential Oil, Cedarwood Essential Oil, Tonka Bean Essential Oil, Oakmoss, Benzyl Salicylate.
International Orders: IPM (Isopropyl Myristate) perfume base rather than alcohol.
`
    const segments = extractShopifyIndieNoteSegmentsFromPlain(source)
    const blob = segments.join("\n").toLowerCase()
    expect(blob).toMatch(/lemon iced tea/)
    expect(blob).toMatch(/sun-dried cotton|sun dried cotton/)
    expect(blob).not.toMatch(/isopropyl/)
    expect(blob).not.toMatch(/not vegan/)
    expect(blob).not.toMatch(/essential oil/)

    const notes = extractNotesFromStructuredText(segments.join("\n"), 2)
    const all = join(notes)
    expect(all).toEqual(expect.arrayContaining(["lemon iced tea", "beeswax", "golden honey"]))
    expect(all.some(n => /isopropyl|not vegan|essential oil/.test(n))).toBe(false)
  })

  it("does not leak Mood adjectives into Head Full of Stars notes", () => {
    const source = `
Fragrance Notes: Lavender Marshmallow • Vanilla Frosting • Violet Petals • Cashmere • Dream Dust Accord • Cookie Crumbs
Mood: Dreamy • Nostalgic • Enchanting
International Orders: IPM (Isopropyl Myristate)
`
    const segments = extractShopifyIndieNoteSegmentsFromPlain(source)
    const blob = segments.join("\n").toLowerCase()
    expect(blob).toMatch(/cookie crumbs/)
    expect(blob).not.toMatch(/nostalgic/)
    expect(blob).not.toMatch(/dreamy/)
    expect(isObviousNonMaterialNote("nostalgic")).toBe(true)

    const notes = extractNotesFromStructuredText(segments.join("\n"), 2)
    const all = join(notes)
    expect(all).toEqual(expect.arrayContaining(["lavender marshmallow", "cookie crumbs"]))
    expect(all).not.toContain("nostalgic")
    expect(all).not.toContain("dreamy")
  })

  it("parses unlabeled Fragrance Notes with middle dots (Tenebrae)", () => {
    const source = `
Tenebrae is a study in shadowed warmth.
Fragrance Notes
Black Currant · Midnight Rose · Incense
The Vibe
Shadowed. Reverent. Commanding.
`
    const unlabeled = extractUnlabeledFragranceNotesBlock(source)
    expect(unlabeled.join(" ").toLowerCase()).toMatch(/black currant|blackcurrant/)
    expect(unlabeled.join(" ").toLowerCase()).toMatch(/incense/)

    const segments = extractShopifyIndieNoteSegmentsFromPlain(source)
    const blob = segments.join("\n").toLowerCase()
    expect(blob).toMatch(/midnight rose/)
    expect(blob).not.toMatch(/reverent/)
    expect(blob).not.toMatch(/commanding/)
  })

  it("parses unlabeled Fragrance Notes bullets instead of noir-invented materials (What Answers Back)", () => {
    const source = `
Inspired by Appalachian folklore.
Fragrance Notes
Cold Fog • Fir Needle • Wet Earth • Oak Moss • Coral Honeysuckle • Cedarwood • Atmospheric Bone Accord • Ambroxan • Labdanum
The Vibe
Wet Appalachian fog rolling through pine trees.
`
    const segments = extractShopifyIndieNoteSegmentsFromPlain(source)
    const all = join(extractNotesFromStructuredText(segments.join("\n"), 2))
    expect(all).toEqual(
      expect.arrayContaining(["cold fog", "fir needle", "wet earth", "oak moss", "ambroxan"]),
    )
    expect(all.join(" ")).not.toMatch(/bergamot|sage|jasmine|lavender/)
  })

  it("unglues Top/Heart/Base and stops before International Orders", () => {
    const source =
      "Top: Peony, Eucalyptus, Cold RainHeart: Midnight Florals, Moss, Damp EarthBase: Ambered Woods, Soft Vanilla, MuskInternational Orders: IPM perfume base"
    const pyramid = extractLayeredHeadingPyramidFromPlain(source)
    expect(pyramid).toBeTruthy()
    expect(pyramid!.toLowerCase()).toMatch(/peony/)
    expect(pyramid!.toLowerCase()).toMatch(/midnight florals/)
    expect(pyramid!.toLowerCase()).toMatch(/\bmusk\b/)
    expect(pyramid!.toLowerCase()).not.toMatch(/international/)
    expect(pyramid!.toLowerCase()).not.toMatch(/isopropyl/)

    const notes = extractNotesFromStructuredText(pyramid!, 2)
    expect(notes.openNotes.map(n => n.toLowerCase())).toEqual(
      expect.arrayContaining(["peony", "eucalyptus", "cold rain"]),
    )
    expect(notes.heartNotes.map(n => n.toLowerCase())).toEqual(
      expect.arrayContaining(["midnight florals", "moss", "damp earth"]),
    )
    expect(notes.baseNotes.map(n => n.toLowerCase()).join(" ")).toMatch(/ambered wood/)
    expect(notes.baseNotes.map(n => n.toLowerCase()).join(" ")).toMatch(/vanilla/)
    expect(notes.baseNotes.map(n => n.toLowerCase())).toEqual(expect.arrayContaining(["musk"]))
  })

  it("does not put Materials of Note chemicals in the confirmation corpus", () => {
    const source = `
Notes: Roasted Coffee • Bittersweet Cocoa • Skin Musk
Materials of Note: Cocoa Absolute, Cinnamic Aldehyde, Milk Lactone.
`
    const corpus = buildNoteConfirmationCorpus(source).toLowerCase()
    expect(corpus).toMatch(/roasted coffee/)
    expect(corpus).not.toMatch(/cinnamic aldehyde/)
    expect(corpus).not.toMatch(/milk lactone/)
  })

  it("structured extract prefers Notes : over Materials of Note : (real Kahvila spacing)", () => {
    // Exact spacing from Shopify product.js description (space before colons).
    const source =
      "Kahvila, Finnish for “café,” is an atmospheric gourmand. Notes : Roasted Coffee • Bittersweet Cocoa • Steamed Oat Milk • Whisper of Cinnamon • White Chocolate Cake • Warm Sugar • Soft Woods • Skin Musk Ingredients : Alcohol Denat., Parfum (Fragrance), Aqua (Water) Materials of Note : Cocoa Absolute, Cinnamic Aldehyde, Milk Lactone, Benzyl Salicylate, Cashmeran. Allergen Notice : This fragrance contains cinnamic aldehyde."
    const notes = extractNotesFromStructuredText(source, 2)
    const all = join(notes)
    expect(all).toEqual(
      expect.arrayContaining(["roasted coffee", "bittersweet cocoa", "steamed oat milk", "skin musk"]),
    )
    expect(all.join(" ")).not.toMatch(/cinnamic|milk lactone|benzyl salicylate/)
  })

  it("structured extract stops Fragrance Notes at Mood without colon (Head Full Of Stars)", () => {
    const source =
      "Fragrance Notes: Lavender Marshmallow • Vanilla Frosting • Violet Petals • Cashmere • Dream Dust Accord • Cookie Crumbs Mood Dreamy • Nostalgic • Enchanting"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = join(notes)
    expect(all).toEqual(
      expect.arrayContaining(["lavender marshmallow", "cookie crumbs", "dream dust accord"]),
    )
    expect(all.some(n => /mood|dreamy|nostalgic|enchanting/.test(n))).toBe(false)
  })

  it("structured extract reads unlabeled Fragrance Notes before bare Vibe (What Answers Back)", () => {
    const source =
      "Fragrance Notes Cold Fog • Fir Needle • Wet Earth • Oak Moss • Coral Honeysuckle • Cedarwood • Atmospheric Bone Accord • Ambroxan • Labdanum Vibe Wet Appalachian fog rolling through pine trees."
    const notes = extractNotesFromStructuredText(source, 2)
    const all = join(notes)
    expect(all).toEqual(
      expect.arrayContaining(["cold fog", "fir needle", "wet earth", "ambroxan", "labdanum"]),
    )
    expect(all.join(" ")).not.toMatch(/bergamot|sage|appalachian|abandoned/)
  })

  it("structured extract ignores Materials of Note when that is the only notes?: label (Cicadas)", () => {
    const source =
      "Notes: Lemon Iced Tea • Humid Summer Air • Sun-Warmed Cedar • Golden Honey • Beeswax • Weathered Woods • Sun-Dried Cotton Please Note: This fragrance contains beeswax absolute and is therefore not vegan. Materials of Note: Beeswax Absolute (Not Vegan), Lemon Essential Oil, Bergamot Essential Oil, Cedarwood Essential Oil, Tonka Bean Essential Oil, Oakmoss, Benzyl Salicylate."
    const notes = extractNotesFromStructuredText(source, 2)
    const all = join(notes)
    expect(all).toEqual(
      expect.arrayContaining(["lemon iced tea", "golden honey", "beeswax", "sun-dried cotton"]),
    )
    expect(all.some(n => /essential oil|benzyl salicylate|not vegan/.test(n))).toBe(false)
  })
})
